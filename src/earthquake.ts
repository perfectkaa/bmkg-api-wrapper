import { HTTPClient } from "./http.js";
import { Cache } from "./cache.js";
import { BMKGParseError } from "./errors.js";
import { EarthquakeInfo } from "./types.js";

const EARTHQUAKE_BASE_URL = "https://data.bmkg.go.id/DataMKG/TEWS";
const LATEST_CACHE_TTL = 30000; // 30 seconds
const RECENT_CACHE_TTL = 300000; // 5 minutes
const FELT_CACHE_TTL = 300000; // 5 minutes

interface InfogempaRoot {
  Infogempa: {
    gempa: any;
  };
}

export class EarthquakeModule {
  private readonly latestCache: Cache;
  private readonly recentCache: Cache;
  private readonly feltCache: Cache;

  constructor(
    private readonly http: HTTPClient,
    private readonly enableCache: boolean
  ) {
    this.latestCache = new Cache(LATEST_CACHE_TTL);
    this.recentCache = new Cache(RECENT_CACHE_TTL);
    this.feltCache = new Cache(FELT_CACHE_TTL);
  }

  /**
   * Fetch the latest earthquake (single event).
   */
  async getLatest(): Promise<EarthquakeInfo> {
    const url = `${EARTHQUAKE_BASE_URL}/autogempa.json`;
    const cacheKey = "earthquake:latest";

    if (this.enableCache) {
      const cached = this.latestCache.get<EarthquakeInfo>(cacheKey);
      if (cached) return cached;
    }

    const promise = this.fetchLatest();
    if (this.enableCache) {
      this.latestCache.setPending(cacheKey, promise);
    }

    try {
      const result = await promise;
      if (this.enableCache) {
        this.latestCache.set(cacheKey, result);
      }
      return result;
    } finally {
      if (this.enableCache) {
        this.latestCache.deletePending(cacheKey);
      }
    }
  }

  /**
   * Fetch recent earthquakes (M 5.0+).
   */
  async getRecent(): Promise<EarthquakeInfo[]> {
    const url = `${EARTHQUAKE_BASE_URL}/gempaterkini.json`;
    const cacheKey = "earthquake:recent";

    if (this.enableCache) {
      const cached = this.recentCache.get<EarthquakeInfo[]>(cacheKey);
      if (cached) return cached;
    }

    const promise = this.fetchRecent();
    if (this.enableCache) {
      this.recentCache.setPending(cacheKey, promise);
    }

    try {
      const result = await promise;
      if (this.enableCache) {
        this.recentCache.set(cacheKey, result);
      }
      return result;
    } finally {
      if (this.enableCache) {
        this.recentCache.deletePending(cacheKey);
      }
    }
  }

  /**
   * Fetch felt earthquakes.
   */
  async getFelt(): Promise<EarthquakeInfo[]> {
    const url = `${EARTHQUAKE_BASE_URL}/gempadirasakan.json`;
    const cacheKey = "earthquake:felt";

    if (this.enableCache) {
      const cached = this.feltCache.get<EarthquakeInfo[]>(cacheKey);
      if (cached) return cached;
    }

    const promise = this.fetchFelt();
    if (this.enableCache) {
      this.feltCache.setPending(cacheKey, promise);
    }

    try {
      const result = await promise;
      if (this.enableCache) {
        this.feltCache.set(cacheKey, result);
      }
      return result;
    } finally {
      if (this.enableCache) {
        this.feltCache.deletePending(cacheKey);
      }
    }
  }

  private async fetchLatest(): Promise<EarthquakeInfo> {
    const raw = await this.http.get<InfogempaRoot>(
      `${EARTHQUAKE_BASE_URL}/autogempa.json`
    );
    const gempa = raw?.Infogempa?.gempa;
    if (!gempa || typeof gempa !== "object") {
      throw new BMKGParseError("Invalid autogempa response");
    }
    return this.parseEarthquake(gempa);
  }

  private async fetchRecent(): Promise<EarthquakeInfo[]> {
    const raw = await this.http.get<InfogempaRoot>(
      `${EARTHQUAKE_BASE_URL}/gempaterkini.json`
    );
    const gempaList = raw?.Infogempa?.gempa;
    if (!Array.isArray(gempaList)) {
      throw new BMKGParseError("Invalid gempaterkini response");
    }
    return gempaList.map((g) => this.parseEarthquake(g));
  }

  private async fetchFelt(): Promise<EarthquakeInfo[]> {
    const raw = await this.http.get<InfogempaRoot>(
      `${EARTHQUAKE_BASE_URL}/gempadirasakan.json`
    );
    const gempaList = raw?.Infogempa?.gempa;
    if (!Array.isArray(gempaList)) {
      throw new BMKGParseError("Invalid gempadirasakan response");
    }
    return gempaList.map((g) => this.parseEarthquake(g));
  }

  private parseEarthquake(g: any): EarthquakeInfo {
    return {
      datetime: g.DateTime ? String(g.DateTime) : "",
      magnitude: parseFloat(g.Magnitude) || 0,
      depth: parseFloat(g.Kedalaman) || 0,
      latitude: this.parseCoordinate(g.Lintang),
      longitude: this.parseCoordinate(g.Bujur),
      region: g.Wilayah ? String(g.Wilayah) : "",
      felt: g.Dirasakan ? String(g.Dirasakan) : undefined,
      tsunamiPotential: g.Potensi ? String(g.Potensi) : undefined,
      shakemap: g.Shakemap ? String(g.Shakemap) : undefined,
    };
  }

  private parseCoordinate(value: any): number {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return 0;
    // Handle Indonesian format: "0.73 LS", "131.39 BT", "0.73 LU", "131.39 BB"
    const match = value.match(/([\d.]+)\s*([A-Z]+)/i);
    if (match) {
      const num = parseFloat(match[1]);
      const dir = match[2].toUpperCase();
      // LS = Laut Selatan (South), LU = Laut Utara (North)
      // BT = Bujur Timur (East), BB = Bujur Barat (West)
      if (dir === "LS" || dir === "S" || dir === "BB" || dir === "W") return -num;
      return num;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
}