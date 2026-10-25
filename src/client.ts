import { HTTPClient } from "./http.js";
import { Cache } from "./cache.js";
import { WeatherModule } from "./weather.js";
import { EarthquakeModule } from "./earthquake.js";
import { WarningModule } from "./warning.js";
import type {
  BMKGClientOptions,
  EarthquakeInfo,
  ForecastItem,
  LocationInfo,
  WeatherForecastResponse,
  WeatherWarningDetail,
  WeatherWarningSummary,
} from "./types.js";

export interface BMKGClient {
  weather: {
    validateAdm4: (code: string) => boolean;
    getForecast: (adm4: string) => Promise<WeatherForecastResponse>;
  };
  earthquake: {
    getLatest: () => Promise<EarthquakeInfo>;
    getRecent: () => Promise<EarthquakeInfo[]>;
    getFelt: () => Promise<EarthquakeInfo[]>;
  };
  warning: {
    getAll: (lang?: "id" | "en") => Promise<WeatherWarningSummary[]>;
    getDetail: (
      urlOrId: string,
      lang?: "id" | "en"
    ) => Promise<WeatherWarningDetail>;
  };
}

export function createBMKGClient(
  options: BMKGClientOptions = {}
): BMKGClient {
  const http = new HTTPClient({
    timeout: options.timeout,
    retries: options.retries,
    userAgent: options.userAgent,
  });

  const cacheTtl = options.cacheTtl ?? 300000;
  const enableCache = options.enableCache ?? true;

  const weather = new WeatherModule(http, enableCache, cacheTtl);
  const earthquake = new EarthquakeModule(http, enableCache);
  const warning = new WarningModule(
    http,
    enableCache,
    (options as any).language ?? "id"
  );

  return {
    weather: {
      validateAdm4: (code: string) => weather.validateAdm4(code),
      getForecast: (adm4: string) => weather.getForecast(adm4),
    },
    earthquake: {
      getLatest: () => earthquake.getLatest(),
      getRecent: () => earthquake.getRecent(),
      getFelt: () => earthquake.getFelt(),
    },
    warning: {
      getAll: (lang?: "id" | "en") => warning.getAll(lang),
      getDetail: (
        urlOrId: string,
        lang?: "id" | "en"
      ) => warning.getDetail(urlOrId, lang),
    },
  };
}

export {
  BMKGError,
} from "./errors.js";

export type {
  BMKGClientOptions,
  EarthquakeInfo,
  ForecastItem,
  LocationInfo,
  WeatherForecastResponse,
  WeatherWarningDetail,
  WeatherWarningSummary,
} from "./types.js";