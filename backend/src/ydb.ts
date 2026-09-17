import { randomUUID } from "node:crypto";

import { AnonymousCredentialsProvider } from "@ydbjs/auth/anonymous";
import { EnvironCredentialsProvider } from "@ydbjs/auth/environ";
import { MetadataCredentialsProvider } from "@ydbjs/auth/metadata";
import { Driver } from "@ydbjs/core";
import { query, unsafe, type QueryClient } from "@ydbjs/query";

import {
  benchmarkSchema,
  monitorSchema,
  type Benchmark,
  type Dashboard,
  type Me,
  type Monitor,
  type VacancyInput,
} from "@hackathon-max/contracts";

import type { Environment } from "./config.js";
import type { Identity } from "./domain/max-auth.js";
import { nextRunAt, type AppStore, type StoredMonitor } from "./store.js";

type UserRow = {
  user_id: string;
  first_name: string;
  company_id: string;
  company_name: string;
};

type MonitorRow = {
  monitor_id: string;
  company_id: string;
  owner_user_id: string;
  title: string;
  region_code: string;
  region_name: string;
  offered_salary: bigint;
  status: "active" | "paused";
  created_at: string;
  updated_at: string;
  next_run_at: string;
};

type SnapshotRow = { payload: string };
type NotificationChatRow = { chat_id: string };

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    user_id Utf8 NOT NULL,
    first_name Utf8 NOT NULL,
    company_id Utf8 NOT NULL,
    company_name Utf8 NOT NULL,
    created_at Utf8 NOT NULL,
    PRIMARY KEY (user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS vacancy_monitors (
    owner_user_id Utf8 NOT NULL,
    monitor_id Utf8 NOT NULL,
    company_id Utf8 NOT NULL,
    title Utf8 NOT NULL,
    region_code Utf8 NOT NULL,
    region_name Utf8 NOT NULL,
    offered_salary Int64 NOT NULL,
    status Utf8 NOT NULL,
    created_at Utf8 NOT NULL,
    updated_at Utf8 NOT NULL,
    next_run_at Utf8 NOT NULL,
    PRIMARY KEY (owner_user_id, monitor_id),
    INDEX due_monitors GLOBAL ON (status, next_run_at)
  )`,
  `CREATE TABLE IF NOT EXISTS market_snapshots (
    monitor_id Utf8 NOT NULL,
    fetched_at Utf8 NOT NULL,
    snapshot_id Utf8 NOT NULL,
    payload Utf8 NOT NULL,
    PRIMARY KEY (monitor_id, fetched_at, snapshot_id)
  )`,
  `CREATE TABLE IF NOT EXISTS notification_chats (
    user_id Utf8 NOT NULL,
    chat_id Utf8 NOT NULL,
    updated_at Utf8 NOT NULL,
    PRIMARY KEY (user_id)
  )`,
];

function monitorFromRow(row: MonitorRow): StoredMonitor {
  const monitor = monitorSchema.parse({
    id: row.monitor_id,
    companyId: row.company_id,
    title: row.title,
    region: { code: row.region_code, name: row.region_name },
    offeredSalaryRub: Number(row.offered_salary),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    nextRunAt: row.next_run_at,
  });
  return { ...monitor, ownerUserId: row.owner_user_id };
}

export class YdbStore implements AppStore {
  private constructor(
    private readonly driver: Driver,
    private readonly sql: QueryClient,
  ) {}

  static async connect(environment: Environment): Promise<YdbStore> {
    const connectionString = environment.YDB_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error("YDB connection string is missing");
    }

    const credentialsProvider =
      environment.YDB_AUTH_MODE === "metadata"
        ? new MetadataCredentialsProvider()
        : environment.YDB_AUTH_MODE === "environment"
          ? new EnvironCredentialsProvider(connectionString)
          : new AnonymousCredentialsProvider();
    const driver = new Driver(connectionString, { credentialsProvider });
    await driver.ready();
    return new YdbStore(driver, query(driver, { poolOptions: { maxSize: 5 } }));
  }

  async migrate(): Promise<void> {
    for (const statement of schemaStatements) {
      await this.sql`${unsafe(statement)}`;
    }
  }

  async close(): Promise<void> {
    await this.sql[Symbol.asyncDispose]();
    await this.driver.close();
  }

  async health(): Promise<void> {
    await this.sql`SELECT 1 AS ok`;
  }

  async getOrCreateWorkspace(identity: Identity): Promise<Me> {
    const [rows] = await this.sql<[UserRow]>`
      SELECT user_id, first_name, company_id, company_name
      FROM users
      WHERE user_id = ${identity.id}
    `;
    const existing = rows?.[0];
    if (existing) {
      return {
        user: { id: existing.user_id, firstName: existing.first_name },
        company: { id: existing.company_id, name: existing.company_name },
        developmentIdentity: identity.development,
      };
    }

    const companyId = randomUUID();
    const companyName = `Команда ${identity.firstName}`;
    await this.sql`
      UPSERT INTO users (user_id, first_name, company_id, company_name, created_at)
      VALUES (${identity.id}, ${identity.firstName}, ${companyId}, ${companyName}, ${new Date().toISOString()})
    `;
    return {
      user: { id: identity.id, firstName: identity.firstName },
      company: { id: companyId, name: companyName },
      developmentIdentity: identity.development,
    };
  }

  private async findMonitor(userId: string): Promise<StoredMonitor | null> {
    const [rows] = await this.sql<[MonitorRow]>`
      SELECT * FROM vacancy_monitors
      WHERE owner_user_id = ${userId}
      LIMIT 1
    `;
    const row = rows?.[0];
    return row ? monitorFromRow(row) : null;
  }

  async getDashboard(userId: string): Promise<Dashboard | null> {
    const monitor = await this.findMonitor(userId);
    if (!monitor) {
      return null;
    }

    const [rows] = await this.sql<[SnapshotRow]>`
      SELECT payload FROM market_snapshots
      WHERE monitor_id = ${monitor.id}
      ORDER BY fetched_at DESC
      LIMIT 1
    `;
    const payload = rows?.[0]?.payload;
    return {
      monitor,
      benchmark: payload ? benchmarkSchema.parse(JSON.parse(payload)) : null,
    };
  }

  async saveMonitor(userId: string, input: VacancyInput): Promise<Monitor> {
    const workspaceRows = await this.sql<[UserRow]>`
      SELECT user_id, first_name, company_id, company_name
      FROM users WHERE user_id = ${userId}
    `;
    const workspace = workspaceRows[0]?.[0];
    if (!workspace) {
      throw new Error("Workspace must exist before saving a monitor");
    }

    const existing = await this.findMonitor(userId);
    const now = new Date().toISOString();
    const monitor: StoredMonitor = {
      id: existing?.id ?? randomUUID(),
      companyId: workspace.company_id,
      ownerUserId: userId,
      ...input,
      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      nextRunAt: nextRunAt(),
    };
    await this.sql`
      UPSERT INTO vacancy_monitors (
        owner_user_id, monitor_id, company_id, title, region_code, region_name,
        offered_salary, status, created_at, updated_at, next_run_at
      ) VALUES (
        ${userId}, ${monitor.id}, ${monitor.companyId}, ${monitor.title},
        ${monitor.region.code}, ${monitor.region.name}, ${BigInt(monitor.offeredSalaryRub)},
        ${monitor.status}, ${monitor.createdAt}, ${monitor.updatedAt}, ${monitor.nextRunAt}
      )
    `;
    return monitor;
  }

  async saveBenchmark(monitor: StoredMonitor, benchmark: Benchmark): Promise<void> {
    const nextRun = nextRunAt();
    await this.sql.begin(async (transaction) => {
      await transaction`
        INSERT INTO market_snapshots (monitor_id, fetched_at, snapshot_id, payload)
        VALUES (${monitor.id}, ${benchmark.fetchedAt}, ${randomUUID()}, ${JSON.stringify(benchmark)})
      `;
      await transaction`
        UPDATE vacancy_monitors SET next_run_at = ${nextRun}
        WHERE owner_user_id = ${monitor.ownerUserId} AND monitor_id = ${monitor.id}
      `;
    });
  }

  async getDueMonitors(now: string, limit: number): Promise<StoredMonitor[]> {
    const [rows] = await this.sql<[MonitorRow]>`
      SELECT * FROM vacancy_monitors VIEW due_monitors
      WHERE status = ${"active"} AND next_run_at <= ${now}
      ORDER BY status, next_run_at
      LIMIT ${BigInt(limit)}
    `;
    return (rows ?? []).map(monitorFromRow);
  }

  async setNotificationChat(userId: string, chatId: string): Promise<void> {
    await this.sql`
      UPSERT INTO notification_chats (user_id, chat_id, updated_at)
      VALUES (${userId}, ${chatId}, ${new Date().toISOString()})
    `;
  }

  async getNotificationChat(userId: string): Promise<string | null> {
    const [rows] = await this.sql<[NotificationChatRow]>`
      SELECT chat_id FROM notification_chats WHERE user_id = ${userId}
    `;
    return rows?.[0]?.chat_id ?? null;
  }
}

export async function createStore(environment: Environment): Promise<AppStore> {
  if (environment.DATA_STORE === "ydb") {
    return YdbStore.connect(environment);
  }

  const { MemoryStore } = await import("./memory-store.js");
  return new MemoryStore();
}

export async function migrateYdb(environment: Environment): Promise<void> {
  const store = await YdbStore.connect(environment);
  try {
    await store.migrate();
  } finally {
    await store.close();
  }
}
