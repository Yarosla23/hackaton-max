import type { Benchmark } from "@hackathon-max/contracts";

import type { Environment } from "./config.js";
import { calculateBenchmark } from "./domain/benchmark.js";
import type { MarketSource } from "./market-source.js";
import { sendMarketAlert } from "./max-bot.js";
import type { AppStore } from "./store.js";

export function hasMaterialChange(previous: Benchmark | null, current: Benchmark): boolean {
  if (!previous) return false;
  if (previous.position !== current.position) return true;
  if (previous.medianSalary === null || current.medianSalary === null) {
    return previous.medianSalary !== current.medianSalary;
  }
  if (previous.medianSalary === 0) return current.medianSalary !== 0;

  return Math.abs(current.medianSalary - previous.medianSalary) / previous.medianSalary >= 0.05;
}

export async function refreshDueMonitors(
  store: AppStore,
  marketSource: MarketSource,
  environment: Environment,
  limit = 20,
): Promise<{ processed: number; failed: number; notified: number }> {
  const monitors = await store.getDueMonitors(new Date().toISOString(), limit);
  let processed = 0;
  let failed = 0;
  let notified = 0;

  for (const monitor of monitors) {
    try {
      const previous = (await store.getDashboard(monitor.ownerUserId))?.benchmark ?? null;
      const sample = await marketSource.fetch(monitor);
      const current = calculateBenchmark(monitor, sample);
      await store.saveBenchmark(monitor, current);
      processed += 1;

      if (previous && hasMaterialChange(previous, current)) {
        const chatId = await store.getNotificationChat(monitor.ownerUserId);
        if (chatId) {
          try {
            if (await sendMarketAlert(chatId, monitor, previous, current, environment)) {
              notified += 1;
            }
          } catch (error) {
            console.error("MAX market alert failed", { monitorId: monitor.id, error });
          }
        }
      }
    } catch (error) {
      failed += 1;
      console.error("Scheduled benchmark failed", { monitorId: monitor.id, error });
    }
  }

  return { processed, failed, notified };
}

export function isTimerEvent(event: unknown): boolean {
  return (
    typeof event === "object" &&
    event !== null &&
    "messages" in event &&
    Array.isArray((event as { messages?: unknown }).messages)
  );
}

export function assertWorkerConfigured(environment: Environment): void {
  if (environment.NODE_ENV === "production" && environment.DATA_STORE !== "ydb") {
    throw new Error("Production worker requires YDB");
  }
}
