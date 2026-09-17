import { randomUUID } from "node:crypto";

import type {
  Benchmark,
  Dashboard,
  Me,
  Monitor,
  VacancyInput,
} from "@hackathon-max/contracts";

import type { Identity } from "./domain/max-auth.js";
import { nextRunAt, type AppStore, type StoredMonitor } from "./store.js";

type Workspace = Me & { monitorId: string | null };

export class MemoryStore implements AppStore {
  private readonly workspaces = new Map<string, Workspace>();
  private readonly monitors = new Map<string, StoredMonitor>();
  private readonly benchmarks = new Map<string, Benchmark>();
  private readonly notificationChats = new Map<string, string>();

  async health(): Promise<void> {}

  async getOrCreateWorkspace(identity: Identity): Promise<Me> {
    const existing = this.workspaces.get(identity.id);
    if (existing) {
      return existing;
    }

    const workspace: Workspace = {
      user: { id: identity.id, firstName: identity.firstName },
      company: { id: randomUUID(), name: `Команда ${identity.firstName}` },
      developmentIdentity: identity.development,
      monitorId: null,
    };
    this.workspaces.set(identity.id, workspace);
    return workspace;
  }

  async getDashboard(userId: string): Promise<Dashboard | null> {
    const workspace = this.workspaces.get(userId);
    if (!workspace?.monitorId) {
      return null;
    }

    const monitor = this.monitors.get(workspace.monitorId);
    if (!monitor) {
      return null;
    }

    return {
      monitor,
      benchmark: this.benchmarks.get(monitor.id) ?? null,
    };
  }

  async saveMonitor(userId: string, input: VacancyInput): Promise<Monitor> {
    const workspace = this.workspaces.get(userId);
    if (!workspace) {
      throw new Error("Workspace must exist before saving a monitor");
    }

    const existing = workspace.monitorId
      ? this.monitors.get(workspace.monitorId)
      : undefined;
    const now = new Date().toISOString();
    const monitor: StoredMonitor = {
      id: existing?.id ?? randomUUID(),
      companyId: workspace.company.id,
      ownerUserId: userId,
      ...input,
      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      nextRunAt: nextRunAt(),
    };
    this.monitors.set(monitor.id, monitor);
    workspace.monitorId = monitor.id;
    return monitor;
  }

  async saveBenchmark(monitor: StoredMonitor, benchmark: Benchmark): Promise<void> {
    this.benchmarks.set(monitor.id, benchmark);
    this.monitors.set(monitor.id, { ...monitor, nextRunAt: nextRunAt() });
  }

  async getDueMonitors(now: string, limit: number): Promise<StoredMonitor[]> {
    return [...this.monitors.values()]
      .filter((monitor) => monitor.status === "active" && monitor.nextRunAt <= now)
      .sort((left, right) => left.nextRunAt.localeCompare(right.nextRunAt))
      .slice(0, limit);
  }

  async setNotificationChat(userId: string, chatId: string): Promise<void> {
    this.notificationChats.set(userId, chatId);
  }

  async getNotificationChat(userId: string): Promise<string | null> {
    return this.notificationChats.get(userId) ?? null;
  }
}
