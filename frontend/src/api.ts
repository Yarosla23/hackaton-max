import {
  dashboardSchema,
  errorSchema,
  meSchema,
  monitorSchema,
  vacancyInputSchema,
  type Dashboard,
  type Me,
  type VacancyInput,
} from "@hackathon-max/contracts";

export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (window.WebApp?.initData) headers.set("Authorization", `Max ${window.WebApp.initData}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    const parsed = errorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiRequestError(parsed.success ? parsed.data.detail : "Сервис временно недоступен", response.status);
  }
  return response;
}

export const api = {
  async me(): Promise<Me> {
    return meSchema.parse(await (await request("/api/me")).json());
  },
  async dashboard(): Promise<Dashboard | null> {
    try {
      return dashboardSchema.parse(await (await request("/api/dashboard")).json());
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) return null;
      throw error;
    }
  },
  async saveMonitor(input: VacancyInput) {
    const validated = vacancyInputSchema.parse(input);
    return monitorSchema.parse(await (await request("/api/monitor", { method: "PUT", body: JSON.stringify(validated) })).json());
  },
  async runBenchmark(): Promise<Dashboard> {
    return dashboardSchema.parse(await (await request("/api/monitor/benchmark", { method: "POST" })).json());
  },
};

