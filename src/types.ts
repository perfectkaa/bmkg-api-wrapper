/**
 * Public configuration options for BMKG client.
 */
export interface BMKGClientOptions {
  timeout?: number; // request timeout in ms
  retries?: number; // number of retry attempts
  cacheTtl?: number; // global cache TTL in ms
  userAgent?: string; // optional custom user‑agent header
  enableCache?: boolean; // true by default
}

/**
 * Location metadata used in weather forecasts.
 */
export interface LocationInfo {
  adm1: string;
  adm2: string;
  adm3: string;
  adm4: string;
  provinsi: string;
  kotkab: string;
  kecamatan: string;
  desa: string;
  lon: number;
  lat: number;
  timezone: string;
  type?: string;
}

/**
 * A single forecast entry.
 */
export interface ForecastItem {
  utcDateTime: string; // ISO string in UTC
  localDateTime: string; // ISO string in local time
  temperature: number; // Celsius
  humidity: number; // percentage
  weatherDesc: string;
  weatherDescEn?: string;
  windSpeed: number; // km/h
  windDirectionDeg: number;
  windDirection: string; // cardinal direction (e.g., SE)
  cloudCover: number; // percentage
  visibility?: number; // km, optional
  analysisDate?: string; // ISO string, optional
}

/**
 * Normalised weather forecast response.
 */
export interface WeatherForecastResponse {
  location: LocationInfo;
  forecasts: ForecastItem[];
  analysisDate?: string;
}

/**
 * Earthquake information (latest, recent, or felt).
 */
export interface EarthquakeInfo {
  datetime: string; // ISO datetime string
  magnitude: number;
  depth: number; // km
  latitude: number;
  longitude: number;
  region: string;
  felt?: string; // optional detail on felt intensity
  tsunamiPotential?: string; // optional
  shakemap?: string; // optional URL to shakemap image
}

/**
 * Summary of a weather warning from RSS feed.
 */
export interface WeatherWarningSummary {
  title: string;
  link: string;
  description: string;
  author?: string;
  pubDate: string; // RFC 1123 string
  guid: string;
}

/**
 * Detailed weather warning (CAP format).
 */
export interface WeatherWarningDetail {
  identifier: string;
  sender: string;
  sent: string; // ISO datetime
  status: string;
  msgType: string;
  scope: string;
  info: {
    language: string;
    category: string;
    event: string;
    urgency: string;
    severity: string;
    certainty: string;
    effective: string;
    expires: string;
    senderName: string;
    headline: string;
    description: string;
    web?: string;
    area: {
      areaDesc: string;
      polygons?: string[]; // array of space‑separated lat,lon pairs
      circles?: string[];
    };
  };
}