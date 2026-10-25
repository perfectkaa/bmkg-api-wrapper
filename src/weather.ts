import { HTTPClient } from "./http.js";
import { Cache } from "./cache.js";
import {
  BMKValidationError,
  BMKGParseError,
} from "./errors.js";
import {
  ForecastItem,
  LocationInfo,
  WeatherForecastResponse,
} from "./types.js";

const WEATHER_BASE_URL = "https://api.bmkg.go.id";
const WEATHER_CACHE_TTL = 600000; // 10 minutes
const ADM4_REGEX = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/;

interface RawWeatherResponse {
  lokasi: any;
  data: Array<{ cuaca: any[] }>;
}

export class WeatherModule {
  private readonly cache: Cache;

  constructor(
    private readonly http: HTTPClient,
    private readonly enableCache: boolean,
    cacheTtl: number
  ) {
    this.cache = new Cache(cacheTtl || WEATHER_CACHE_TTL);
  }

  /**
   * Validate an administrative area IV code (e.g., "31.71.03.1001").
   */
  validateAdm4(code: string): boolean {
    if (typeof code !== "string") return false;
    return ADM4_REGEX.test(code);
  }

  /**
   * Fetch weather forecast for the given adm4 code.
   */
  async getForecast(adm4: string): Promise<WeatherForecastResponse> {
    if (!this.validateAdm4(adm4)) {
      throw new BMKValidationError(
        `Invalid adm4 code: ${adm4}. Expected format: XX.XX.XX.XXXX`
      );
    }

    const url = `${WEATHER_BASE_URL}/publik/prakiraan-cuaca?adm4=${adm4}`;
    const cacheKey = `weather:${adm4}`;

    if (this.enableCache) {
      const cached = this.cache.get<WeatherForecastResponse>(cacheKey);
      if (cached) return cached;
    }

    // Deduplicate concurrent requests
    if (this.enableCache) {
      const pending = this.cache.getPending<WeatherForecastResponse>(cacheKey);
      if (pending) return pending;
    }

    const promise = this.fetchForecast(url);
    if (this.enableCache) {
      this.cache.setPending(cacheKey, promise);
    }

    try {
      const result = await promise;
      if (this.enableCache) {
        this.cache.set(cacheKey, result);
      }
      return result;
    } finally {
      if (this.enableCache) {
        this.cache.deletePending(cacheKey);
      }
    }
  }

  private async fetchForecast(
    url: string
  ): Promise<WeatherForecastResponse> {
    const raw = await this.http.get<RawWeatherResponse>(url);

    if (!raw || typeof raw !== "object") {
      throw new BMKGParseError("Invalid weather forecast response");
    }

    const location = this.parseLocation(raw.lokasi);
    const forecasts = this.parseForecastData(raw.data);

    return {
      location,
      forecasts,
      analysisDate: forecasts[0]?.analysisDate,
    };
  }

  private parseLocation(raw: any): LocationInfo {
    if (!raw || typeof raw !== "object") {
      throw new BMKGParseError("Missing or invalid location data");
    }
    return {
      adm1: String(raw.adm1 ?? ""),
      adm2: String(raw.adm2 ?? ""),
      adm3: String(raw.adm3 ?? ""),
      adm4: String(raw.adm4 ?? ""),
      provinsi: String(raw.provinsi ?? ""),
      kotkab: String(raw.kotkab ?? ""),
      kecamatan: String(raw.kecamatan ?? ""),
      desa: String(raw.desa ?? ""),
      lon: parseFloat(raw.lon) || 0,
      lat: parseFloat(raw.lat) || 0,
      timezone: String(raw.timezone ?? ""),
      type: raw.type ? String(raw.type) : undefined,
    };
  }

  private parseForecastData(raw: any): ForecastItem[] {
    if (!Array.isArray(raw)) {
      throw new BMKGParseError("Invalid forecast data array");
    }

    const items: ForecastItem[] = [];
    for (const day of raw) {
      if (!day || !Array.isArray(day.cuaca)) continue;
      // day.cuaca is an array of arrays (each sub-array is a time period)
      for (const period of day.cuaca) {
        if (!Array.isArray(period)) continue;
        for (const entry of period) {
          if (!entry || typeof entry !== "object") continue;
          items.push(this.parseForecastEntry(entry));
        }
      }
    }
    return items;
  }

  private parseForecastEntry(entry: any): ForecastItem {
    return {
      utcDateTime: String(entry.datetime ?? ""),
      localDateTime: String(entry.local_datetime ?? ""),
      temperature: parseFloat(entry.t) || 0,
      humidity: parseFloat(entry.hu) || 0,
      weatherDesc: String(entry.weather_desc ?? ""),
      weatherDescEn: entry.weather_desc_en
        ? String(entry.weather_desc_en)
        : undefined,
      windSpeed: parseFloat(entry.ws) || 0,
      windDirectionDeg: parseFloat(entry.wd_deg) || 0,
      windDirection: String(entry.wd ?? ""),
      cloudCover: parseFloat(entry.tcc) || 0,
      visibility: entry.vs ? parseFloat(entry.vs) : undefined,
      analysisDate: entry.analysis_date
        ? String(entry.analysis_date)
        : undefined,
    };
  }
}