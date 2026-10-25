import { HTTPClient } from "./http.js";
import { Cache } from "./cache.js";
import { BMKGError, BMKGParseError } from "./errors.js";
import {
  WeatherWarningDetail,
  WeatherWarningSummary,
} from "./types.js";

import { XMLParser } from "fast-xml-parser";

const WARNING_BASE_URL = "https://www.bmkg.go.id";
const WARNING_LIST_CACHE_TTL = 60000; // 1 minute
const WARNING_DETAIL_CACHE_TTL = 120000; // 2 minutes

export class WarningModule {
  private readonly listCache: Cache;
  private readonly detailCache: Cache;
  private readonly xmlParser: XMLParser;

  constructor(
    private readonly http: HTTPClient,
    private readonly enableCache: boolean,
    private readonly language: "id" | "en" = "id"
  ) {
    this.listCache = new Cache(WARNING_LIST_CACHE_TTL);
    this.detailCache = new Cache(WARNING_DETAIL_CACHE_TTL);
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      attributeNamePrefix: "",
    });
  }

  /**
   * Get list of active weather warnings.
   */
  async getAll(
    lang?: "id" | "en"
  ): Promise<WeatherWarningSummary[]> {
    const language = lang ?? this.language;
    const url = `${WARNING_BASE_URL}/alerts/nowcast/${language}`;
    const cacheKey = `warning:list:${language}`;

    if (this.enableCache) {
      const cached = this.listCache.get<WeatherWarningSummary[]>(cacheKey);
      if (cached) return cached;
    }

    const promise = this.fetchWarningList(language);
    if (this.enableCache) {
      this.listCache.setPending(cacheKey, promise);
    }

    try {
      const result = await promise;
      if (this.enableCache) {
        this.listCache.set(cacheKey, result);
      }
      return result;
    } finally {
      if (this.enableCache) {
        this.listCache.deletePending(cacheKey);
      }
    }
  }

  /**
   * Get detail of a specific weather warning by URL or alert ID.
   * URL validation prevents SSRF.
   */
  async getDetail(
    urlOrId: string,
    lang?: "id" | "en"
  ): Promise<WeatherWarningDetail> {
    const language = lang ?? this.language;
    const fullUrl = this.resolveWarningUrl(urlOrId, language);
    const cacheKey = `warning:detail:${fullUrl}`;

    if (this.enableCache) {
      const cached = this.detailCache.get<WeatherWarningDetail>(cacheKey);
      if (cached) return cached;
    }

    const promise = this.fetchWarningDetail(fullUrl);
    if (this.enableCache) {
      this.detailCache.setPending(cacheKey, promise);
    }

    try {
      const result = await promise;
      if (this.enableCache) {
        this.detailCache.set(cacheKey, result);
      }
      return result;
    } finally {
      if (this.enableCache) {
        this.detailCache.deletePending(cacheKey);
      }
    }
  }

  private resolveWarningUrl(urlOrId: string, lang: "id" | "en"): string {
    if (urlOrId.startsWith("http://") || urlOrId.startsWith("https://")) {
      const parsed = new URL(urlOrId);
      if (
        parsed.hostname !== "www.bmkg.go.id" &&
        parsed.hostname !== "bmkg.go.id"
      ) {
        throw new BMKGError(
          "Invalid warning URL host: only bmkg.go.id is allowed",
          undefined,
          "INVALID_URL"
        );
      }
      if (!parsed.pathname.startsWith("/alerts/nowcast/")) {
        throw new BMKGError(
          "Invalid warning URL path",
          undefined,
          "INVALID_URL"
        );
      }
      return urlOrId;
    }

    // Treat as alert ID (e.g., "CPU20261025003_alert.xml")
    const cleanId = urlOrId.replace(/^\/+/, "");
    return `${WARNING_BASE_URL}/alerts/nowcast/${lang}/${cleanId}`;
  }

  private async fetchWarningList(
    language: "id" | "en"
  ): Promise<WeatherWarningSummary[]> {
    const rawXml = await this.http.get<string>(
      `${WARNING_BASE_URL}/alerts/nowcast/${language}`
    );
    const xmlText = typeof rawXml === "string" ? rawXml : String(rawXml);

    let parsed: any;
    try {
      parsed = this.xmlParser.parse(xmlText);
    } catch (err) {
      throw new BMKGParseError(
        `Failed to parse warning RSS: ${(err as Error).message}`,
        xmlText
      );
    }

    const rss = parsed?.rss;
    if (!rss) {
      if (xmlText.trim().length > 0) {
        throw new BMKGParseError(
          "Invalid RSS structure: missing rss element",
          xmlText
        );
      }
      return [];
    }

    const channel = rss.channel;
    const items = channel?.item;
    if (!items) return [];

    const list = Array.isArray(items) ? items : [items];
    return list.map((item: any) => {
      let guid = "";
      if (item.guid) {
        if (typeof item.guid === "object") {
          guid = String(
            item.guid["#text"] ?? item.guid._ ?? Object.values(item.guid)[0] ?? ""
          );
        } else {
          guid = String(item.guid);
        }
      }
      return {
        title: item.title ? String(item.title) : "",
        link: item.link ? String(item.link) : "",
        description: item.description ? String(item.description) : "",
        author: item.author ? String(item.author) : undefined,
        pubDate: item.pubDate ? String(item.pubDate) : "",
        guid,
      };
    });
  }

  private async fetchWarningDetail(url: string): Promise<WeatherWarningDetail> {
    const rawXml = await this.http.get<string>(url);
    const xmlText = typeof rawXml === "string" ? rawXml : String(rawXml);

    let parsed: any;
    try {
      parsed = this.xmlParser.parse(xmlText);
    } catch (err) {
      throw new BMKGParseError(
        `Failed to parse warning CAP detail: ${(err as Error).message}`,
        xmlText
      );
    }

    const alert = parsed?.alert;
    if (!alert) {
      throw new BMKGParseError("Missing alert element in CAP response");
    }

    const info = alert.info;
    if (!info) {
      throw new BMKGParseError("Missing info element in CAP response");
    }

    // fast-xml-parser may return single object or array
    const infoObj = Array.isArray(info) ? info[0] : info;

    return {
      identifier: alert.identifier ? String(alert.identifier) : "",
      sender: alert.sender ? String(alert.sender) : "",
      sent: alert.sent ? String(alert.sent) : "",
      status: alert.status ? String(alert.status) : "",
      msgType: alert.msgType ? String(alert.msgType) : "",
      scope: alert.scope ? String(alert.scope) : "",
      info: {
        language: infoObj.language ? String(infoObj.language) : "",
        category: infoObj.category ? String(infoObj.category) : "",
        event: infoObj.event ? String(infoObj.event) : "",
        urgency: infoObj.urgency ? String(infoObj.urgency) : "",
        severity: infoObj.severity ? String(infoObj.severity) : "",
        certainty: infoObj.certainty ? String(infoObj.certainty) : "",
        effective: infoObj.effective ? String(infoObj.effective) : "",
        expires: infoObj.expires ? String(infoObj.expires) : "",
        senderName: infoObj.senderName ? String(infoObj.senderName) : "",
        headline: infoObj.headline ? String(infoObj.headline) : "",
        description: infoObj.description ? String(infoObj.description) : "",
        web: infoObj.web ? String(infoObj.web) : undefined,
        area: this.parseAreas(infoObj.area),
      },
    };
  }

  private parseAreas(rawArea: any): {
    areaDesc: string;
    polygons?: string[];
    circles?: string[];
  } {
    if (!rawArea) return { areaDesc: "" };

    const areas = Array.isArray(rawArea) ? rawArea : [rawArea];
    const first = areas[0];

    return {
      areaDesc: first?.areaDesc ? String(first.areaDesc) : "",
      polygons: first?.polygon ? this.toArray(first.polygon) : undefined,
      circles: first?.circle ? this.toArray(first.circle) : undefined,
    };
  }

  private toArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(String);
    return [String(value)];
  }
}