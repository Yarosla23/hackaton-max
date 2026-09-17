import { describe, expect, it } from "vitest";

import { readEnvironment } from "./config.js";

describe("readEnvironment", () => {
  it("refuses volatile or demo settings in production", () => {
    expect(() => readEnvironment({ NODE_ENV: "production", MARKET_SOURCE: "demo" })).toThrow();
  });

  it("accepts an explicit production serverless configuration", () => {
    expect(
      readEnvironment({
        NODE_ENV: "production",
        DATA_STORE: "ydb",
        YDB_CONNECTION_STRING: "grpcs://example.net:2135/?database=/ru-central1/example",
        YDB_AUTH_MODE: "metadata",
        MARKET_SOURCE: "live",
        HH_USER_AGENT: "RynokRyadom/0.3 (team@example.test)",
        FRONTEND_ORIGIN: "https://example.apigw.yandexcloud.net",
        BOT_TOKEN: "production-token-with-enough-characters",
        MAX_WEBHOOK_SECRET: "production_webhook_secret",
        MAX_BOT_USERNAME: "RynokRyadomBot",
      }).NODE_ENV,
    ).toBe("production");
  });
});
