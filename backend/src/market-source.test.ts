import { afterEach, describe, expect, it, vi } from "vitest";

import type { VacancyInput } from "@hackathon-max/contracts";

import type { MarketSample } from "./domain/benchmark.js";
import {
  CompositeMarketSource,
  HhSource,
  MarketSourceError,
  SuperJobSource,
  TrudvsemSource,
  type MarketSource,
} from "./market-source.js";

const monitor: VacancyInput = {
  title: "Продавец",
  region: { code: "7700000000000", name: "Москва" },
  offeredSalaryRub: 70_000,
};

function sample(source: "trudvsem" | "hh", id: string): MarketSample {
  const url = source === "hh" ? "https://hh.ru/search/vacancy" : "https://trudvsem.ru/";
  return {
    dataMode: "live",
    totalFound: 10,
    fetchedAt: "2026-09-17T12:00:00.000Z",
    sourceUrl: url,
    sources: [{ id: source, name: source, totalFound: 10, salarySampleSize: 1, url }],
    vacancies: [
      {
        id,
        source,
        employer: "Магазин",
        title: "Продавец",
        salaryMin: 60_000,
        salaryMax: 80_000,
        url,
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("HhSource", () => {
  it("normalizes complete RUB salary ranges and rejects partial ranges", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        found: 2,
        items: [
          {
            id: "1",
            name: "Продавец",
            alternate_url: "https://hh.ru/vacancy/1",
            employer: { name: "Магазин" },
            salary: { from: 60_000, to: 80_000, currency: "RUR" },
          },
          {
            id: "2",
            name: "Продавец",
            alternate_url: "https://hh.ru/vacancy/2",
            employer: { name: "Другой магазин" },
            salary: { from: 60_000, to: null, currency: "RUR" },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new HhSource(
      "https://api.hh.ru/",
      "RynokRyadom/0.3 (team@example.test)",
    ).fetch(monitor);

    expect(result.vacancies).toHaveLength(1);
    expect(result.vacancies[0]).toMatchObject({ id: "hh:1", source: "hh" });
    expect(result.sources[0]).toMatchObject({ totalFound: 2, salarySampleSize: 1 });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("area=1");
  });
});

describe("TrudvsemSource", () => {
  it("accepts the decorated ruble currency returned by the live API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          meta: { total: 1 },
          results: {
            vacancies: [
              {
                vacancy: {
                  id: "vacancy-1",
                  "job-name": "Продавец",
                  salary_min: 60_000,
                  salary_max: 80_000,
                  currency: "«руб.»",
                  vac_url: "https://trudvsem.ru/vacancy/card/1",
                  company: { name: "Магазин" },
                },
              },
            ],
          },
        }),
      ),
    );

    const result = await new TrudvsemSource(
      "https://opendata.trudvsem.ru/api/v1/vacancies",
    ).fetch(monitor);

    expect(result.vacancies).toHaveLength(1);
  });
});

describe("SuperJobSource", () => {
  it("normalizes salary ranges when an application key is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        total: 1,
        objects: [
          {
            id: 15,
            profession: "Продавец",
            payment_from: 65_000,
            payment_to: 85_000,
            currency: "rub",
            link: "https://www.superjob.ru/vakansii/15.html",
            client: { title: "Магазин" },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new SuperJobSource(
      "https://api.superjob.ru/2.0/",
      "superjob-test-key",
    ).fetch(monitor);

    expect(result.vacancies[0]).toMatchObject({ id: "superjob:15", source: "superjob" });
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: { "X-Api-App-Id": "superjob-test-key" },
    });
  });
});

describe("CompositeMarketSource", () => {
  it("merges providers and removes cross-posted vacancies", async () => {
    const sources: MarketSource[] = [
      { fetch: async () => sample("trudvsem", "trudvsem:1") },
      { fetch: async () => sample("hh", "hh:1") },
    ];

    const result = await new CompositeMarketSource(sources).fetch(monitor);

    expect(result.totalFound).toBe(20);
    expect(result.sources).toHaveLength(2);
    expect(result.vacancies).toHaveLength(1);
  });

  it("keeps separate postings from the same provider", async () => {
    const repeated = sample("trudvsem", "trudvsem:1");
    repeated.vacancies.push({ ...repeated.vacancies[0]!, id: "trudvsem:2" });

    const result = await new CompositeMarketSource([{ fetch: async () => repeated }]).fetch(
      monitor,
    );

    expect(result.vacancies).toHaveLength(2);
  });

  it("keeps working when one provider is unavailable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sources: MarketSource[] = [
      { fetch: async () => sample("hh", "hh:1") },
      { fetch: async () => Promise.reject(new MarketSourceError("offline")) },
    ];

    await expect(new CompositeMarketSource(sources).fetch(monitor)).resolves.toMatchObject({
      totalFound: 10,
      sources: [{ id: "hh" }],
    });
  });
});
