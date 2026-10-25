import { describe, it, expect } from "vitest";
import { Cache } from "../src/cache.js";

describe("Cache", () => {
  it("should store and retrieve data", () => {
    const cache = new Cache(60000);
    cache.set("key1", { value: 123 });
    const result = cache.get<{ value: number }>("key1");
    expect(result).toEqual({ value: 123 });
  });

  it("should return null for missing keys", () => {
    const cache = new Cache(60000);
    expect(cache.get("missing")).toBeNull();
  });

  it("should expire after TTL", () => {
    const cache = new Cache(50);
    cache.set("key1", "test");
    expect(cache.get("key1")).toBe("test");

    // Mock date advance
    const originalNow = Date.now;
    Date.now = () => originalNow() + 100;

    expect(cache.get("key1")).toBeNull();

    Date.now = originalNow;
  });

  it("should support custom TTL per entry", () => {
    const cache = new Cache(60000);
    cache.set("short", "expires soon", 10);
    cache.set("long", "expires later", 60000);

    const originalNow = Date.now;
    Date.now = () => originalNow() + 50;

    expect(cache.get("short")).toBeNull();
    expect(cache.get("long")).toBe("expires later");

    Date.now = originalNow;
  });

  it("should delete keys", () => {
    const cache = new Cache(60000);
    cache.set("key1", "test");
    expect(cache.has("key1")).toBe(true);
    cache.delete("key1");
    expect(cache.has("key1")).toBe(false);
  });

  it("should clear all keys", () => {
    const cache = new Cache(60000);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.clear();
    expect(cache.size()).toBe(0);
  });
});