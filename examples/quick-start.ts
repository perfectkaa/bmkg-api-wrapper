/**
 * Quick start example for bmkg-ts
 * Run with: node --loader tsx examples/quick-start.ts
 * or: npx tsx examples/quick-start.ts
 */

import { createBMKGClient } from "../src/index.js";

async function main() {
  const bmkg = createBMKGClient({
    timeout: 10000,
    retries: 3,
    cacheTtl: 300000,
    userAgent: "bmkg-ts-example/1.0",
  });

  try {
    // Weather forecast
    console.log("=== Weather Forecast ===");
    const weather = await bmkg.weather.getForecast("31.71.03.1001");
    console.log(`Location: ${weather.location.provinsi}, ${weather.location.kecamatan}`);
    console.log(`Forecasts: ${weather.forecasts.length} entries`);
    if (weather.forecasts.length > 0) {
      const f = weather.forecasts[0];
      console.log(
        `First: ${f.temperature}°C, ${f.weatherDesc}, Wind ${f.windSpeed} km/h ${f.windDirection}`
      );
    }

    // Earthquakes
    console.log("\n=== Earthquakes ===");
    const latest = await bmkg.earthquake.getLatest();
    console.log(`Latest: M${latest.magnitude} at ${latest.region}`);

    const recent = await bmkg.earthquake.getRecent();
    console.log(`Recent earthquakes: ${recent.length} events`);

    const felt = await bmkg.earthquake.getFelt();
    console.log(`Felt earthquakes: ${felt.length} events`);

    // Weather warnings
    console.log("\n=== Weather Warnings ===");
    const warnings = await bmkg.warning.getAll("id");
    console.log(`Active warnings: ${warnings.length}`);
    if (warnings.length > 0) {
      const detail = await bmkg.warning.getDetail(warnings[0].link);
      console.log(`Detail: ${detail.info.headline}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
  }
}

main().catch(console.error);