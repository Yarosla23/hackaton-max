import type {
  Benchmark,
  Dashboard,
  Me,
  Monitor,
  VacancyInput,
} from "@hackathon-max/contracts";

import type { Identity } from "./domain/max-auth.js";

export type StoredMonitor = Monitor & { ownerUserId: string };

export interface AppStore {
  health(): Promise<void>;
  getOrCreateWorkspace(identity: Identity): Promise<Me>;
  getDashboard(userId: string): Promise<Dashboard | null>;
  saveMonitor(userId: string, input: VacancyInput): Promise<Monitor>;
  saveBenchmark(monitor: StoredMonitor, benchmark: Benchmark): Promise<void>;
  getDueMonitors(now: string, limit: number): Promise<StoredMonitor[]>;
  setNotificationChat(userId: string, chatId: string): Promise<void>;
  getNotificationChat(userId: string): Promise<string | null>;
}

export function nextRunAt(from: Date = new Date()): string {
  return new Date(from.getTime() + 24 * 60 * 60 * 1000).toISOString();
}
