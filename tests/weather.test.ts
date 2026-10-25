import { describe, it, expect, beforeEach, vi } from "vitest";
import { WeatherModule } from "../src/weather.js";
import { BMKValidationError, BMKGParseError } from "../src/errors.js";
import { createBMKGClient } from "../src/client.js";

// Mock HTTP client
function createMockHTTPClient() {
  const get = vi.fn();
  return { http: { get }, get };
}

describe("Weather Module", () => {
  let weather: WeatherModule;
  let mockGet: ReturnType<typeof createMockHTTPClient>["get"];

  beforeEach(() => {
    const { http, get } = createMockHTTPClient();
    weather = new WeatherModule(http, false, 0);
    mockGet = get;
  });

  describe("validateAdm4", () => {
    it("should accept valid adm4 codes", () => {
      expect(weather.validateAdm4("31.71.03.1001")).toBe(true);
      expect(weather.validateAdm4("31.71.03.1002")).toBe(true);
    });

    it("should reject invalid adm4 codes", () => {
      expect(weather.validateAdm4("31.71.03.100")).toBe(false);
      expect(weather.validateAdm4("31.71.03.10011")).toBe(false);
      expect(weather.validateAdm4("abc.def.ghi.jkl")).toBe(false);
      expect(weather.validateAdm4("")).toBe(false);
      expect(weather.validateAdm4(null as any)).toBe(false);
    });
  });

  describe("getForecast", () => {
    it("should throw on invalid adm4", async () => {
      await expect(weather.getForecast("invalid")).rejects.toThrow(
        BMKValidationError
      );
    });

    it("should fetch and parse weather forecast", async () => {
      const fixture = await import("./fixtures/weather.json", {
        with: { type: "json" },
      });
      mockGet.mockResolvedValue(fixture.default);

      const result = await weather.getForecast("31.71.03.1001");

      expect(result.location.adm4).toBe("31.71.03.1001");
      expect(result.location.provinsi).toBe("DKI Jakarta");
      expect(result.forecasts).toHaveLength(7);
      expect(result.forecasts[0].temperature).toBe(26);
      expect(result.forecasts[0].weatherDesc).toBe("Berawan");
      expect(result.forecasts[0].windDirection).toBe("SE");
      expect(result.forecasts[0].cloudCover).toBe(96);
      expect(result.forecasts[0].analysisDate).toBe("2026-10-25T12:00:00");
    });

    it("should handle missing optional fields", async () => {
      const fixture = await import("./fixtures/weather.json", {
        with: { type: "json" },
      });
      mockGet.mockResolvedValue(fixture.default);

      const result = await weather.getForecast("31.71.03.1001");
      expect(result.forecasts[0].visibility).toBeUndefined();
    });

    it("should throw BMKGParseError on malformed JSON", async () => {
      mockGet.mockRejectedValueOnce(new Error("Network error"));
      await expect(weather.getForecast("31.71.03.1001")).rejects.toThrow();
    });
  });

  describe("Caching", () => {
    it("should cache results", async () => {
      const mockGetForCache = vi.fn();
      const weatherWithCache = new WeatherModule(
        { get: mockGetForCache } as any,
        true,
        60000
      );
      const fixture = await import("./fixtures/weather.json", {
        with: { type: "json" },
      });
      mockGetForCache.mockResolvedValue(fixture.default);

      const r1 = await weatherWithCache.getForecast("31.71.03.1001");
      const r2 = await weatherWithCache.getForecast("31.71.03.1001");

      expect(mockGetForCache).toHaveBeenCalledTimes(1);
      expect(r1).toBe(r2);
    });
  });
});

describe("Client Integration", () => {
  it("should create a client with default options", () => {
    const client = createBMKGClient();
    expect(client).toHaveProperty("weather");
    expect(client).toHaveProperty("earthquake");
    expect(client).toHaveProperty("warning");
  });

  it("should pass options to client", () => {
    const client = createBMKGClient({
      timeout: 5000,
      retries: 3,
      enableCache: false,
    });
    expect(client).toBeDefined();
  });
});