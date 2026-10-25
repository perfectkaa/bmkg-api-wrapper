import { vi } from "vitest";

// Default mock for fetch if not provided by environment
globalThis.fetch =
  globalThis.fetch ||
  vi.fn(async () => {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as any;