import { bootstrap } from "./bootstrap.js";
import { readEnvironment } from "./config.js";
import { handleHttpEvent } from "./function-adapter.js";
import { migrateYdb } from "./ydb.js";

let application: ReturnType<typeof bootstrap> | undefined;

export async function handler(event: Parameters<typeof handleHttpEvent>[0] | { action: "migrate" }) {
  if ("action" in event) {
    await migrateYdb(readEnvironment());
    return { statusCode: 200, body: JSON.stringify({ migrated: true }) };
  }

  application ??= bootstrap();
  const { app } = await application;
  return handleHttpEvent(event, app.fetch);
}
