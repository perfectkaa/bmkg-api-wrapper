# bmkg-ts

TypeScript wrapper for the official Open Data API of **BMKG Indonesia**
(Badan Meteorologi, Klimatologi, dan Geofisika).

Access weather forecasts, earthquake data, and early weather warnings from
BMKG public endpoints in a type-safe, dependency-light package.

> **Not an official BMKG package.** This is a community wrapper. Data and
> service availability are owned by BMKG and not guaranteed by this project.
> See [Attribution](#attribution) and [Disclaimer](#disclaimer).

---

## Features

| Module | Methods | Source |
|--------|---------|--------|
| Weather | `getForecast(adm4)`, `validateAdm4(code)` | `https://api.bmkg.go.id/publik/prakiraan-cuaca` |
| Earthquake | `getLatest()`, `getRecent()`, `getFelt()` | `https://data.bmkg.go.id/DataMKG/TEWS/` |
| Warning | `getAll(lang?)`, `getDetail(urlOrId, lang?)` | `https://www.bmkg.go.id/alerts/nowcast/` (RSS + CAP/XML) |

- TypeScript strict mode, explicit types (no `any` in public API)
- Native `fetch` with `AbortController` timeout
- Retry with exponential backoff + jitter (429 and 5xx only)
- In-memory cache with configurable TTL and concurrent-request deduplication
- SSRF-protected warning detail URLs (only `bmkg.go.id` host allowed)
- ESM + CommonJS dual build via `tsup`
- Tested with `vitest` using local fixtures (no internet required)

---

## Requirements

- Node.js **20+**
- Package manager: `npm`

---

## Installation

```bash
npm install bmkg-ts
```

The package ships with ESM (`dist/index.mjs`), CommonJS (`dist/index.js`),
and TypeScript declarations (`dist/index.d.ts`).

---

## Quick Start

### TypeScript / ESM

```ts
import { createBMKGClient } from "bmkg-ts";

const bmkg = createBMKGClient();

// Weather forecast (3-day)
const weather = await bmkg.weather.getForecast("31.71.03.1001");
console.log(weather.location.provinsi); // DKI Jakarta
console.log(weather.forecasts[0].temperature); // e.g. 32

// Latest earthquake
const quake = await bmkg.earthquake.getLatest();
console.log(quake.magnitude, quake.region);

// Recent earthquakes (M 5.0+)
const recent = await bmkg.earthquake.getRecent();

// Felt earthquakes
const felt = await bmkg.earthquake.getFelt();

// Weather warnings (Indonesian)
const warnings = await bmkg.warning.getAll("id");

// Warning detail by ID
const detail = await bmkg.warning.getDetail(
  "CPU20261025003_alert.xml",
  "id"
);
console.log(detail.info.event);
console.log(detail.info.effective);
console.log(detail.info.expires);
```

### CommonJS

```js
const { createBMKGClient } = require("bmkg-ts");

const bmkg = createBMKGClient();

bmkg.weather
  .getForecast("31.71.03.1001")
  .then((weather) => console.log(weather.location.provinsi));
```

---

## Client Configuration

```ts
import { createBMKGClient } from "bmkg-ts";

const bmkg = createBMKGClient({
  timeout: 10000,        // request timeout in ms (default: 8000)
  retries: 2,            // retry attempts for 429/5xx (default: 2)
  cacheTtl: 300000,      // global default cache TTL in ms (default: 300000)
  userAgent: "my-app/1.0", // custom User-Agent header (default: bmkg-ts/1.0.0)
  enableCache: true,     // toggle in-memory cache (default: true)
});
```

Per-module cache TTL defaults (wrapper policy, not official BMKG schedule):

| Module | Default TTL |
|--------|-------------|
| Weather forecast | 10 minutes |
| Latest earthquake | 30 seconds |
| Recent / felt earthquakes | 5 minutes |
| Warning list | 1 minute |
| Warning detail | 2 minutes |

Cache keys are based on URL and relevant parameters. Only successful,
valid responses are cached. Concurrent requests for the same key are
deduplicated. Cache is in-memory only and is not persisted.

---

## API Reference

### `createBMKGClient(options?)`

Returns a client with three namespaces: `weather`, `earthquake`, `warning`.

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `8000` | HTTP request timeout in milliseconds |
| `retries` | `number` | `2` | Max retry attempts for 429 and 5xx responses |
| `cacheTtl` | `number` | `300000` | Default in-memory cache TTL in milliseconds |
| `userAgent` | `string` | `"bmkg-ts/1.0.0"` | Custom `User-Agent` header |
| `enableCache` | `boolean` | `true` | Enable/disable in-memory cache |

---

### Weather Module

#### `weather.validateAdm4(code)`

Validate an Indonesian administrative area level 4 (adm4) code.

```ts
bmkg.weather.validateAdm4("31.71.03.1001"); // true
bmkg.weather.validateAdm4("invalid");       // false
```

Expected format: `XX.XX.XX.XXXX` (digits separated by dots).

#### `weather.getForecast(adm4)`

Fetch a 3-day weather forecast for the given `adm4` code.

```ts
const forecast = await bmkg.weather.getForecast("31.71.03.1001");
```

**Response:** `WeatherForecastResponse`

```ts
interface LocationInfo {
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

interface ForecastItem {
  utcDateTime: string;        // ISO UTC
  localDateTime: string;      // ISO local
  temperature: number;        // Celsius
  humidity: number;           // percentage
  weatherDesc: string;        // e.g. "Berawan"
  weatherDescEn?: string;
  windSpeed: number;          // km/h
  windDirectionDeg: number;
  windDirection: string;      // cardinal, e.g. "SE"
  cloudCover: number;         // percentage
  visibility?: number;        // km, optional
  analysisDate?: string;      // ISO, optional
}

interface WeatherForecastResponse {
  location: LocationInfo;
  forecasts: ForecastItem[];
  analysisDate?: string;
}
```

Throws `BMKValidationError` if `adm4` is invalid.  
Throws `BMKGParseError` if the response structure is unexpected.

---

### Earthquake Module

#### `earthquake.getLatest()`

Fetch the latest earthquake event (`autogempa.json`).

```ts
const quake = await bmkg.earthquake.getLatest();
```

#### `earthquake.getRecent()`

Fetch recent earthquakes (M 5.0+, `gempaterkini.json`).

```ts
const list = await bmkg.earthquake.getRecent();
```

#### `earthquake.getFelt()`

Fetch felt earthquakes (`gempadirasakan.json`).

```ts
const list = await bmkg.earthquake.getFelt();
```

**Response:** `EarthquakeInfo` or `EarthquakeInfo[]`

```ts
interface EarthquakeInfo {
  datetime: string;           // ISO datetime from BMKG
  magnitude: number;
  depth: number;              // km
  latitude: number;           // negative for South (LS)
  longitude: number;          // negative for West (BB)
  region: string;
  felt?: string;              // felt intensity info, if available
  tsunamiPotential?: string;  // tsunami potential, if available
  shakemap?: string;          // shakemap URL, if available
}
```

Coordinates are parsed from BMKG's Indonesian format (e.g. `"0.73 LS"` →
`-0.73`, `"131.39 BT"` → `131.39`).

---

### Warning Module

#### `warning.getAll(lang?)`

List active weather warnings from the RSS feed.

```ts
const idWarnings = await bmkg.warning.getAll("id");
const enWarnings = await bmkg.warning.getAll("en");
```

Default language is whatever was set in client options (defaults to `"id"`).

**Response:** `WeatherWarningSummary[]`

```ts
interface WeatherWarningSummary {
  title: string;
  link: string;
  description: string;
  author?: string;
  pubDate: string;   // RFC 1123
  guid: string;
}
```

An empty array means no active warnings were found in the feed — it does
not necessarily mean there are no weather hazards; BMKG may not have
published a CAP alert at that time.

#### `warning.getDetail(urlOrId, lang?)`

Fetch and parse a specific CAP/XML warning detail.

```ts
// By alert ID
const detail = await bmkg.warning.getDetail("CPU20261025003_alert.xml", "id");

// By full URL (only bmkg.go.id host allowed)
const detail = await bmkg.warning.getDetail(
  "https://www.bmkg.go.id/alerts/nowcast/id/CPU20261025003_alert.xml"
);
```

**Response:** `WeatherWarningDetail`

```ts
interface WeatherWarningDetail {
  identifier: string;
  sender: string;
  sent: string;
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
      polygons?: string[]; // space-separated "lat lon" pairs
      circles?: string[];
    };
  };
}
```

**SSRF protection:** Only `http(s)://www.bmkg.go.id` or
`http(s)://bmkg.go.id` hosts under `/alerts/nowcast/` are accepted. Passing
arbitrary external URLs throws `BMKGError`.

---

## Error Handling

All errors extend `BMKGError`:

```ts
import { createBMKGClient, BMKGError, BMKGNetworkError, BMKGTimeoutError, BMKGParseError } from "bmkg-ts";

try {
  const forecast = await bmkg.weather.getForecast("31.71.03.1001");
} catch (err) {
  if (err instanceof BMKGTimeoutError) {
    // Request timed out
  } else if (err instanceof BMKGNetworkError) {
    // Network/DNS failure
  } else if (err instanceof BMKGParseError) {
    // Response could not be parsed
  } else if (err instanceof BMKGError) {
    // HTTP error (4xx/5xx/429) or validation error
  }
}
```

| Error Class | When it occurs |
|-------------|----------------|
| `BMKGError` | HTTP errors, invalid URLs, validation failures |
| `BMKGNetworkError` | Fetch/network failure |
| `BMKGTimeoutError` | Request exceeded `timeout` |
| `BMKGParseError` | JSON/XML parsing failure or unexpected structure |
| `BMKValidationError` | Invalid `adm4` code |

429 (rate limit) and 5xx responses are retried with exponential backoff.
Other 4xx errors are not retried.

---

## Rate Limit & Limitations

BMKG enforces approximately **60 requests per minute per IP**. This wrapper
does not implement a global rate limiter; it uses in-memory caching and
concurrent-request deduplication to reduce duplicate calls. For production
use, coordinate requests across your application instances to stay within
BMKG's limit.

Known limitations:

- Cache is in-memory only (lost on process restart).
- No persistent storage or database is used.
- External service availability depends on BMKG; endpoints may change
  without notice.
- Warning RSS feeds may return zero items even when weather hazards exist,
  if BMKG has not published a CAP alert.
- Earthquake `shakemap`, `felt`, and `tsunamiPotential` fields are optional
  and may be absent from BMKG's response.

---

## Attribution

Weather, earthquake, and warning data are provided by
**BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)**
via their public Open Data endpoints:

- `https://data.bmkg.go.id/`
- `https://api.bmkg.go.id/`
- `https://www.bmkg.go.id/`

This package is **not officially affiliated with, endorsed by, or operated
by BMKG**. All data rights remain with BMKG.

---

## Disclaimer

This is a third-party wrapper. The maintainers do not guarantee the
accuracy, timeliness, or availability of data fetched from BMKG's external
services. Use at your own risk for non-critical applications. Do not rely
on this package for emergency or life-safety decisions without consulting
official BMKG channels.

---

## Development

### Build

```bash
npm run build
```

Outputs to `dist/`:

- `dist/index.mjs` (ESM)
- `dist/index.js` (CommonJS)
- `dist/index.d.ts` (TypeScript declarations)

### Tests

Unit tests run offline using local fixtures:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

Integration tests (require internet, run explicitly):

```bash
vitest run tests/**/*.integration.test.ts
```

### Lint & Format

```bash
npm run lint
npm run format
```

---

## License

MIT
