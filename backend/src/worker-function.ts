import { bootstrap } from "./bootstrap.js";
import { handleHttpEvent } from "./function-adapter.js";
import { handleMaxWebhook } from "./max-bot.js";
import { assertWorkerConfigured, isTimerEvent, refreshDueMonitors } from "./worker.js";

const application = bootstrap();

export async function handler(event: unknown) {
  const { environment, marketSource, store } = await application;
  assertWorkerConfigured(environment);

  if (isTimerEvent(event)) {
    return refreshDueMonitors(store, marketSource, environment);
  }

  return handleHttpEvent(
    event as Parameters<typeof handleHttpEvent>[0],
    (request) => handleMaxWebhook(request, environment, store),
  );
}
