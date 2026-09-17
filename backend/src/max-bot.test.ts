import { describe, expect, it } from "vitest";

import { readEnvironment } from "./config.js";
import { handleMaxWebhook } from "./max-bot.js";
import { MemoryStore } from "./memory-store.js";

const environment = readEnvironment({
  NODE_ENV: "test",
  MAX_WEBHOOK_SECRET: "test_webhook_secret",
});

describe("handleMaxWebhook", () => {
  it("rejects a request without the configured MAX secret", async () => {
    const store = new MemoryStore();
    const response = await handleMaxWebhook(
      new Request("https://example.test/max/webhook", {
        method: "POST",
        body: JSON.stringify({
          update_type: "bot_started",
          chat_id: 42,
          user: { user_id: 7, name: "Анна" },
        }),
      }),
      environment,
      store,
    );
    expect(response.status).toBe(401);
    await expect(store.getNotificationChat("7")).resolves.toBeNull();
  });

  it("binds a signed bot-started event to the user's notification chat", async () => {
    const store = new MemoryStore();
    const response = await handleMaxWebhook(
      new Request("https://example.test/max/webhook", {
        method: "POST",
        headers: { "X-Max-Bot-Api-Secret": "test_webhook_secret" },
        body: JSON.stringify({
          update_type: "bot_started",
          chat_id: 42,
          user: { user_id: 7, name: "Анна" },
        }),
      }),
      environment,
      store,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    await expect(store.getNotificationChat("7")).resolves.toBe("42");
    await expect(store.getOrCreateWorkspace({ id: "7", firstName: "Другая", development: false }))
      .resolves.toMatchObject({ user: { id: "7", firstName: "Анна" } });
  });
});
