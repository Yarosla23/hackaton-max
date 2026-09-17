import { z } from "zod";

import type {
  MarketSourceId,
  MarketSourceSummary,
  VacancyInput,
} from "@hackathon-max/contracts";

import type { MarketSample, MarketVacancy } from "./domain/benchmark.js";

const trudvsemVacancySchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    vac_url: z.string().optional(),
    "job-name": z.string().default("Вакансия"),
    salary_min: z.union([z.string(), z.number(), z.null()]).optional(),
    salary_max: z.union([z.string(), z.number(), z.null()]).optional(),
    currency: z.string().nullable().optional(),
    company: z.object({ name: z.string().default("Работодатель") }).optional(),
  })
  .passthrough();

const trudvsemResponseSchema = z.object({
  meta: z
    .object({ total: z.union([z.string(), z.number()]).transform(Number) })
    .passthrough(),
  results: z.object({
    vacancies: z.array(z.object({ vacancy: trudvsemVacancySchema })).default([]),
  }),
});

const hhResponseSchema = z.object({
  found: z.number().int().nonnegative(),
  items: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      alternate_url: z.string().url(),
      employer: z.object({ name: z.string() }).nullable(),
      salary: z
        .object({
          from: z.number().int().positive().nullable(),
          to: z.number().int().positive().nullable(),
          currency: z.string(),
        })
        .nullable(),
    }),
  ),
});

const superJobResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  objects: z.array(
    z.object({
      id: z.number().int(),
      profession: z.string(),
      payment_from: z.number().int().nonnegative(),
      payment_to: z.number().int().nonnegative(),
      currency: z.string(),
      link: z.string().url(),
      client: z.object({ title: z.string() }),
    }),
  ),
});

const hhAreaByRegionCode: Readonly<Record<string, string>> = {
  "7700000000000": "1",
  "7800000000000": "2",
  "5000000000000": "2019",
  "6600000000000": "1261",
};

export interface MarketSource {
  fetch(monitor: VacancyInput): Promise<MarketSample>;
}

export class MarketSourceError extends Error {}

function money(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function isRubles(currency: string | null | undefined): boolean {
  if (!currency) return true;
  const normalized = currency.trim().toUpperCase().replace(/[^\p{L}]/gu, "");
  return ["RUB", "RUR", "РУБ", "РУБЛЬ", "РУБЛЕЙ"].includes(normalized);
}

function summary(
  id: MarketSourceId,
  name: string,
  totalFound: number,
  salarySampleSize: number,
  url: string,
): MarketSourceSummary {
  return { id, name, totalFound, salarySampleSize, url };
}

async function getJson(url: URL, headers: HeadersInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new MarketSourceError("Источник вакансий не ответил вовремя", { cause: error });
  }
  if (!response.ok) {
    throw new MarketSourceError(`Источник вакансий ответил кодом ${response.status}`);
  }
  return response.json();
}

export class TrudvsemSource implements MarketSource {
  constructor(private readonly baseUrl: string) {}

  async fetch(monitor: VacancyInput): Promise<MarketSample> {
    const url = new URL(`${this.baseUrl}/region/${monitor.region.code}`);
    url.searchParams.set("text", monitor.title);
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", "0");
    const parsed = trudvsemResponseSchema.safeParse(
      await getJson(url, { "User-Agent": "RynokRyadom/0.3" }),
    );
    if (!parsed.success) {
      throw new MarketSourceError("Работа России изменила формат ответа");
    }

    const vacancies = parsed.data.results.vacancies
      .map(({ vacancy }): MarketVacancy | null => {
        const salaryMin = money(vacancy.salary_min);
        const salaryMax = money(vacancy.salary_max);
        if (salaryMin === null || salaryMax === null || !isRubles(vacancy.currency)) {
          return null;
        }
        const vacancyUrl = vacancy.vac_url ?? `https://trudvsem.ru/vacancy/${vacancy.id}`;
        if (!URL.canParse(vacancyUrl)) return null;
        return {
          id: `trudvsem:${vacancy.id}`,
          source: "trudvsem",
          employer: vacancy.company?.name ?? "Работодатель",
          title: vacancy["job-name"],
          salaryMin,
          salaryMax,
          url: vacancyUrl,
        };
      })
      .filter((vacancy): vacancy is MarketVacancy => vacancy !== null);

    return {
      dataMode: "live",
      totalFound: parsed.data.meta.total,
      vacancies,
      sourceUrl: url.toString(),
      sources: [
        summary(
          "trudvsem",
          "Работа России",
          parsed.data.meta.total,
          vacancies.length,
          url.toString(),
        ),
      ],
      fetchedAt: new Date().toISOString(),
    };
  }
}

export class HhSource implements MarketSource {
  constructor(
    private readonly baseUrl: string,
    private readonly userAgent: string,
    private readonly accessToken?: string,
  ) {}

  async fetch(monitor: VacancyInput): Promise<MarketSample> {
    const area = hhAreaByRegionCode[monitor.region.code];
    if (!area) throw new MarketSourceError(`HH: неизвестный регион ${monitor.region.name}`);

    const url = new URL("vacancies", this.baseUrl);
    url.searchParams.set("text", monitor.title);
    url.searchParams.set("area", area);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", "0");
    url.searchParams.set("label", "with_salary");
    const headers = new Headers({ "HH-User-Agent": this.userAgent });
    if (this.accessToken) headers.set("Authorization", `Bearer ${this.accessToken}`);
    const parsed = hhResponseSchema.safeParse(await getJson(url, headers));
    if (!parsed.success) throw new MarketSourceError("HH изменил формат ответа");

    const vacancies = parsed.data.items
      .map((vacancy): MarketVacancy | null => {
        const salaryMin = money(vacancy.salary?.from);
        const salaryMax = money(vacancy.salary?.to);
        if (salaryMin === null || salaryMax === null || !isRubles(vacancy.salary?.currency)) {
          return null;
        }
        return {
          id: `hh:${vacancy.id}`,
          source: "hh",
          employer: vacancy.employer?.name ?? "Работодатель",
          title: vacancy.name,
          salaryMin,
          salaryMax,
          url: vacancy.alternate_url,
        };
      })
      .filter((vacancy): vacancy is MarketVacancy => vacancy !== null);

    return {
      dataMode: "live",
      totalFound: parsed.data.found,
      vacancies,
      sourceUrl: url.toString(),
      sources: [summary("hh", "HeadHunter", parsed.data.found, vacancies.length, url.toString())],
      fetchedAt: new Date().toISOString(),
    };
  }
}

export class SuperJobSource implements MarketSource {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async fetch(monitor: VacancyInput): Promise<MarketSample> {
    const url = new URL("vacancies/", this.baseUrl);
    url.searchParams.set("keyword", monitor.title);
    url.searchParams.set("town", monitor.region.name);
    url.searchParams.set("count", "100");
    url.searchParams.set("page", "0");
    url.searchParams.set("no_agreement", "1");
    const parsed = superJobResponseSchema.safeParse(
      await getJson(url, { "X-Api-App-Id": this.apiKey }),
    );
    if (!parsed.success) throw new MarketSourceError("SuperJob изменил формат ответа");

    const vacancies = parsed.data.objects
      .map((vacancy): MarketVacancy | null => {
        const salaryMin = money(vacancy.payment_from);
        const salaryMax = money(vacancy.payment_to);
        if (salaryMin === null || salaryMax === null || !isRubles(vacancy.currency)) {
          return null;
        }
        return {
          id: `superjob:${vacancy.id}`,
          source: "superjob",
          employer: vacancy.client.title,
          title: vacancy.profession,
          salaryMin,
          salaryMax,
          url: vacancy.link,
        };
      })
      .filter((vacancy): vacancy is MarketVacancy => vacancy !== null);

    return {
      dataMode: "live",
      totalFound: parsed.data.total,
      vacancies,
      sourceUrl: url.toString(),
      sources: [
        summary("superjob", "SuperJob", parsed.data.total, vacancies.length, url.toString()),
      ],
      fetchedAt: new Date().toISOString(),
    };
  }
}

function dedupeKey(vacancy: MarketVacancy): string {
  const normalize = (value: string) => value.trim().toLocaleLowerCase("ru").replace(/\s+/g, " ");
  return [
    normalize(vacancy.employer),
    normalize(vacancy.title),
    vacancy.salaryMin,
    vacancy.salaryMax,
  ].join("|");
}

export class CompositeMarketSource implements MarketSource {
  constructor(private readonly sources: MarketSource[]) {
    if (sources.length === 0) throw new Error("Composite market source cannot be empty");
  }

  async fetch(monitor: VacancyInput): Promise<MarketSample> {
    const results = await Promise.allSettled(this.sources.map((source) => source.fetch(monitor)));
    const samples = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    results.forEach((result) => {
      if (result.status === "rejected") console.warn("Market provider failed", result.reason);
    });
    if (samples.length === 0) {
      throw new MarketSourceError("Все источники рынка временно недоступны");
    }

    const unique = new Map<string, MarketVacancy>();
    samples.flatMap((sample) => sample.vacancies).forEach((vacancy) => {
      const key = dedupeKey(vacancy);
      const existing = unique.get(key);
      if (!existing) {
        unique.set(key, vacancy);
      } else if (existing.source === vacancy.source) {
        unique.set(`${key}|${vacancy.source}|${vacancy.id}`, vacancy);
      }
    });

    const first = samples[0];
    if (!first) throw new MarketSourceError("Источники не вернули данные");
    return {
      dataMode: samples.every((sample) => sample.dataMode === "demo") ? "demo" : "live",
      totalFound: samples.reduce((total, sample) => total + sample.totalFound, 0),
      vacancies: [...unique.values()],
      sourceUrl: first.sourceUrl,
      sources: samples.flatMap((sample) => sample.sources),
      fetchedAt: new Date().toISOString(),
    };
  }
}

export class DemoMarketSource implements MarketSource {
  async fetch(monitor: VacancyInput): Promise<MarketSample> {
    const salaries = [52_000, 58_000, 64_000, 72_000, 79_000, 86_000, 94_000];
    const sourceUrl = "https://trudvsem.ru/opendata/api";
    const vacancies: MarketVacancy[] = salaries.map((salary, index) => ({
      id: `demo:${index}`,
      source: "demo",
      employer: ["Север", "Точка", "Маяк", "Линия"][index % 4] ?? "Компания",
      title: monitor.title,
      salaryMin: salary - 5_000,
      salaryMax: salary + 5_000,
      url: sourceUrl,
    }));
    return {
      dataMode: "demo",
      totalFound: vacancies.length,
      fetchedAt: new Date().toISOString(),
      sourceUrl,
      sources: [summary("demo", "Демо-выборка", vacancies.length, vacancies.length, sourceUrl)],
      vacancies,
    };
  }
}
