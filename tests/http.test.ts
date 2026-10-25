import { describe, it, expect, vi } from "vitest";
import { HTTPClient } from "../src/http.js";
import {
  BMKGError,
  BMKGNetworkError,
  BMKGTimeoutError,
  BMKGParseError,
} from "../src/errors.js";

describe("HTTP Client", () => {
  let client: HTTPClient;

  beforeEach(() => {
    client = new HTTPClient({ timeout: 1000, retries: 0 });
  });

  describe("Error handling", () => {
    it("should throw BMKGTimeoutError on timeout", async () => {
      const slowUrl = "https://httpbin.org/delay/5";
      const timeoutClient = new HTTPClient({ timeout: 50, retries: 0 });

      await expect(timeoutClient.get(slowUrl)).rejects.toThrow(
        BMKGTimeoutError
      );
    });

    it("should throw BMKGNetworkError on network failure", async () => {
      await expect(client.get("https://invalid-domain-that-does-not-exist.test")).rejects.toThrow(
        BMKGNetworkError
      );
    });

    it("should throw BMKGError on 404", async () => {
      await expect(client.get("https://httpbin.org/status/404")).rejects.toThrow(
        BMKGError
      );
    });

    it("should throw BMKGError on 500", async () => {
      await expect(client.get("https://httpbin.org/status/500")).rejects.toThrow(
        BMKGError
      );
    });

    it("should throw BMKGParseError on invalid JSON", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Map([["content-type", "application/json"]]),
        text: async () => "invalid json {{",
      });
      global.fetch = mockFetch as any;

      await expect(client.get("https://test.com")).rejects.toThrow(
        BMKGParseError
      );
    });
  });

  describe("Retry logic", () => {
    it("should retry on 429", async () => {
      let attempts = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            status: 429,
            text: async () => "Rate limited",
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map([["content-type", "application/json"]]),
          text: async () => '{"success": true}',
        });
      });
      global.fetch = mockFetch as any;

      const retryClient = new HTTPClient({ timeout: 1000, retries: 3 });
      const result = await retryClient.get("https://test.com");
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    it("should retry on 5xx", async () => {
      let attempts = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.resolve({
            ok: false,
            status: 500,
            text: async () => "Server error",
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Map([["content-type", "application/json"]]),
          text: async () => '{"success": true}',
        });
      });
      global.fetch = mockFetch as any;

      const retryClient = new HTTPClient({ timeout: 1000, retries: 2 });
      const result = await retryClient.get("https://test.com");
      expect(result).toEqual({ success: true });
      expect(attempts).toBe(2);
    });

    it("should not retry on 4xx", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => "Not found",
      });
      global.fetch = mockFetch as any;

      const retryClient = new HTTPClient({ timeout: 1000, retries: 3 });
      await expect(retryClient.get("https://test.com")).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});