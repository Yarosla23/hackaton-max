import { describe, expect, it } from "vitest";

import { dashboardSchema } from "@hackathon-max/contracts";

import { createApp } from "./app.js";
import { readEnvironment } from "./config.js";
import { DemoMarketSource } from "./market-source.js";
import { MemoryStore } from "./memory-store.js";

function testApp() {
  return createApp({
    environment: readEnvironment({
      NODE_ENV: "test",
      DEV_AUTH_ENABLED: "true",
      MARKET_SOURCE: "demo",
    }),
    store: new MemoryStore(),
    marketSource: new DemoMarketSource(),
  });
}

describe("market monitor API", () => {
  it("runs the vacancy-to-benchmark vertical slice", async () => {
    const app = testApp();
    const headers = { "Content-Type": "application/json" };

    expect((await app.request("/api/me")).status).toBe(200);
    const saved = await app.request("/api/monitor", {
      method: "PUT",
      headers,
      body: JSON.stringify({
        title: "Продавец-консультант",
        region: { code: "7700000000000", name: "Москва" },
        offeredSalaryRub: 70_000,
      }),
    });
    expect(saved.status).toBe(201);

    const benchmarked = await app.request("/api/monitor/benchmark", { method: "POST" });
    expect(benchmarked.status).toBe(200);
    expect(dashboardSchema.parse(await benchmarked.json()).benchmark?.dataMode).toBe("demo");
  });

  it("does not disguise a missing monitor as an empty dashboard", async () => {
    const response = await testApp().request("/api/dashboard");
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "monitor_not_found" });
  });
});
