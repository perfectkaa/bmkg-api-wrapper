import { describe, it, expect, beforeEach, vi } from "vitest";
import { WarningModule } from "../src/warning.js";
import { BMKGError, BMKGParseError } from "../src/errors.js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function createMockHTTPClient() {
  const get = vi.fn();
  return { http: { get }, get };
}

describe("Warning Module", () => {
  let warning: WarningModule;
  let mockGet: ReturnType<typeof createMockHTTPClient>["get"];

  beforeEach(() => {
    const { http, get } = createMockHTTPClient();
    warning = new WarningModule(http, false, "id");
    mockGet = get;
  });

  describe("getAll", () => {
    it("should parse RSS warnings list", async () => {
      const fixture = readFileSync(join(__dirname, "fixtures/warning_rss_id.xml"), "utf-8");
      mockGet.mockResolvedValue(fixture);

      const results = await warning.getAll();

      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Hujan Lebat disertai Petir di Papua");
      expect(results[0].link).toBe(
        "https://www.bmkg.go.id/alerts/nowcast/id/CPU20261025003_alert.xml"
      );
      expect(results[0].guid).toBe(
        "2.49.0.1.360.0.2026.10.25.15.91.003"
      );
    });

    it("should return empty array when no items", async () => {
      mockGet.mockResolvedValue(
        '<rss version="2.0"><channel></channel></rss>'
      );
      const results = await warning.getAll();
      expect(results).toEqual([]);
    });

    it("should throw BMKGParseError on malformed XML", async () => {
      mockGet.mockResolvedValue("invalid xml {{");
      await expect(warning.getAll()).rejects.toThrow(BMKGParseError);
    });
  });

  describe("getDetail", () => {
    it("should parse CAP detail XML", async () => {
      const fixture = readFileSync(join(__dirname, "fixtures/warning_cap_detail.xml"), "utf-8");
      mockGet.mockResolvedValue(fixture);

      const result = await warning.getDetail(
        "CPU20261025003_alert.xml"
      );

      expect(result.identifier).toBe(
        "2.49.0.1.360.0.2026.10.25.15.91.003"
      );
      expect(result.sender).toBe("cuaca.ekstrem@bmkg.go.id");
      expect(result.status).toBe("Actual");
      expect(result.info.event).toBe("Hujan Lebat dan Petir");
      expect(result.info.senderName).toBe(
        "Badan Meteorologi Klimatologi dan Geofisika"
      );
      expect(result.info.area.areaDesc).toBe("Papua");
      expect(result.info.area.polygons).toHaveLength(1);
    });

    it("should accept full URL and validate host", async () => {
      const fixture = readFileSync(join(__dirname, "fixtures/warning_cap_detail.xml"), "utf-8");
      mockGet.mockResolvedValue(fixture);

      const fullUrl =
        "https://www.bmkg.go.id/alerts/nowcast/id/CPU20261025003_alert.xml";
      const result = await warning.getDetail(fullUrl);

      expect(result.identifier).toBeDefined();
      expect(mockGet).toHaveBeenCalledWith(fullUrl);
    });

    it("should reject invalid host URLs", async () => {
      await expect(
        warning.getDetail("https://evil.com/alert.xml")
      ).rejects.toThrow(BMKGError);
    });

    it("should throw on missing alert element", async () => {
      mockGet.mockResolvedValue('<root></root>');
      await expect(
        warning.getDetail("CPU20261025003_alert.xml")
      ).rejects.toThrow(BMKGParseError);
    });

    it("should throw on missing info element", async () => {
      mockGet.mockResolvedValue('<alert></alert>');
      await expect(
        warning.getDetail("CPU20261025003_alert.xml")
      ).rejects.toThrow(BMKGParseError);
    });
  });

  describe("English language", () => {
    it("should parse English RSS", async () => {
      const mockGetEn = vi.fn();
      const warningEn = new WarningModule(
        { get: mockGetEn } as any,
        false,
        "en"
      );
      const fixture = readFileSync(join(__dirname, "fixtures/warning_rss_id.xml"), "utf-8");
      mockGetEn.mockResolvedValue(fixture);

      const results = await warningEn.getAll("en");
      expect(mockGetEn).toHaveBeenCalledWith(
        "https://www.bmkg.go.id/alerts/nowcast/en"
      );
      expect(results).toHaveLength(2);
    });
  });
});