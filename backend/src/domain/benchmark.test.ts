import { describe, expect, it } from "vitest";

import type { VacancyInput } from "@hackathon-max/contracts";

import { calculateBenchmark, type MarketSample } from "./benchmark.js";

const monitor: VacancyInput = {
  title: "Продавец-консультант",
  region: { code: "7700000000000", name: "Москва" },
  offeredSalaryRub: 70_000,
};

function sample(salaries: number[]): MarketSample {
  return {
    dataMode: "live",
    totalFound: salaries.length + 2,
    fetchedAt: "2026-09-17T12:00:00.000Z",
    sourceUrl: "https://opendata.trudvsem.ru/api/v1/vacancies",
    sources: [
      {
        id: "trudvsem",
        name: "Работа России",
        totalFound: salaries.length + 2,
        salarySampleSize: salaries.length,
        url: "https://opendata.trudvsem.ru/api/v1/vacancies",
      },
    ],
    vacancies: salaries.map((salary, index) => ({
      id: String(index),
      source: "trudvsem",
      employer: `Работодатель ${index}`,
      title: monitor.title,
      salaryMin: salary - 5_000,
      salaryMax: salary + 5_000,
      url: `https://trudvsem.ru/vacancy/${index}`,
    })),
  };
}

describe("calculateBenchmark", () => {
  it("calculates the median, percentile and excluded records", () => {
    const result = calculateBenchmark(monitor, sample([50_000, 60_000, 70_000, 80_000, 90_000]));

    expect(result).toMatchObject({
      medianSalary: 70_000,
      percentile: 60,
      position: "in_market",
      salarySampleSize: 5,
      excludedWithoutRange: 2,
      insufficientData: false,
    });
  });

  it("marks a small sample instead of presenting it as reliable", () => {
    const result = calculateBenchmark(monitor, sample([50_000, 60_000]));

    expect(result.insufficientData).toBe(true);
    expect(result.medianSalary).toBe(55_000);
  });

  it("returns nullable metrics for an empty salary sample", () => {
    const result = calculateBenchmark(monitor, sample([]));

    expect(result).toMatchObject({
      medianSalary: null,
      percentile: null,
      position: null,
      marketMin: null,
      marketMax: null,
    });
  });
});
