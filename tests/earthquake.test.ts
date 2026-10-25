import { describe, it, expect, beforeEach, vi } from "vitest";
import { EarthquakeModule } from "../src/earthquake.js";
import { BMKGParseError } from "../src/errors.js";
import { Cache } from "../src/cache.js";

function createMockHTTPClient() {
  const get = vi.fn();
  return { http: { get }, get };
}

describe("Earthquake Module", () => {
  let earthquake: EarthquakeModule;
  let mockGet: ReturnType<typeof createMockHTTPClient>["get"];

  beforeEach(() => {
    const { http, get } = createMockHTTPClient();
    earthquake = new EarthquakeModule(http, false);
    mockGet = get;
  });

  describe("getLatest", () => {
    it("should fetch and parse latest earthquake", async () => {
      const fixture = await import("./fixtures/autogempa.json", {
        with: { type: "json" },
      });
      mockGet.mockResolvedValue(fixture.default);

      const result = await earthquake.getLatest();

      expect(result.magnitude).toBe(3.8);
      expect(result.depth).toBe(6);
      expect(result.latitude).toBe(-0.73);
      expect(result.longitude).toBe(131.39);
      expect(result.region).toContain("Sorong");
      expect(result.felt).toBe("II Kota Sorong");
      expect(result.tsunamiPotential).toContain("dirasakan");
      expect(result.shakemap).toBe("20261025194726.mmi.jpg");
    });

    it("should throw BMKGParseError on invalid response", async () => {
      mockGet.mockResolvedValue({ invalid: "data" });
      await expect(earthquake.getLatest()).rejects.toThrow(BMKGParseError);
    });
  });

  describe("getRecent", () => {
    it("should fetch and parse recent earthquakes", async () => {
      const fixture = await import("./fixtures/gempaterkini.json", {
        with: { type: "json" },
      });
      mockGet.mockResolvedValue(fixture.default);

      const results = await earthquake.getRecent();

      expect(results).toHaveLength(2);
      expect(results[0].magnitude).toBe(5.2);
      expect(results[0].depth).toBe(120);
      expect(results[0].tsunamiPotential).toBe("Tidak berpotensi tsunami");
      expect(results[1].magnitude).toBe(5.1);
    });

    it("should throw on non-array response", async () => {
      mockGet.mockResolvedValue({ Infogempa: { gempa: "not array" } });
      await expect(earthquake.getRecent()).rejects.toThrow(BMKGParseError);
    });
  });

  describe("getFelt", () => {
    it("should fetch and parse felt earthquakes", async () => {
      const fixture = await import("./fixtures/gempadirasakan.json", {
        with: { type: "json" },
      });
      mockGet.mockResolvedValue(fixture.default);

      const results = await earthquake.getFelt();

      expect(results).toHaveLength(2);
      expect(results[0].magnitude).toBe(3.8);
      expect(results[0].felt).toBe("II Kota Sorong");
      expect(results[1].magnitude).toBe(4.7);
      expect(results[1].felt).toBe("IV Gayo Lues");
    });
  });

  describe("Coordinate parsing", () => {
    it("should parse latitude correctly", async () => {
      const fixture = await import("./fixtures/autogempa.json", {
        with: { type: "json" },
      });
      mockGet.mockResolvedValue(fixture.default);

      const result = await earthquake.getLatest();
      expect(result.latitude).toBe(-0.73);
    });

    it("should parse longitude correctly", async () => {
      const fixture = await import("./fixtures/autogempa.json", {
        with: { type: "json" },
      });
      mockGet.mockResolvedValue(fixture.default);

      const result = await earthquake.getLatest();
      expect(result.longitude).toBe(131.39);
    });
  });

  describe("Caching", () => {
    it("should cache latest earthquake", async () => {
      const mockGetForCache = vi.fn();
      const eqWithCache = new EarthquakeModule(
        { get: mockGetForCache } as any,
        true
      );
      const fixture = await import("./fixtures/autogempa.json", {
        with: { type: "json" },
      });
      mockGetForCache.mockResolvedValue(fixture.default);

      const r1 = await eqWithCache.getLatest();
      const r2 = await eqWithCache.getLatest();

      expect(mockGetForCache).toHaveBeenCalledTimes(1);
      expect(r1).toBe(r2);
    });
  });
});