import { describe, expect, it } from "vitest";

import type { Benchmark } from "@hackathon-max/contracts";

import { hasMaterialChange } from "./worker.js";

function benchmark(overrides: Partial<Benchmark> = {}): Benchmark {
  return {
    dataMode: "demo",
    totalFound: 10,
    salarySampleSize: 10,
    medianSalary: 100_000,
    marketMin: 80_000,
    marketMax: 140_000,
    percentile: 50,
    position: "in_market",
    insufficientData: false,
    query: "Менеджер",
    regionName: "Москва",
    fetchedAt: "2026-09-17T12:00:00.000Z",
    sourceUrl: "https://example.test/vacancies",
    sources: [],
    excludedWithoutRange: 0,
    competitors: [],
    ...overrides,
  };
}

describe("hasMaterialChange", () => {
  it("does not notify on the initial or a small market movement", () => {
    expect(hasMaterialChange(null, benchmark())).toBe(false);
    expect(hasMaterialChange(benchmark(), benchmark({ medianSalary: 104_999 }))).toBe(false);
  });

  it("notifies at a five-percent median movement or position change", () => {
    expect(hasMaterialChange(benchmark(), benchmark({ medianSalary: 105_000 }))).toBe(true);
    expect(hasMaterialChange(benchmark(), benchmark({ position: "below_market" }))).toBe(true);
  });
});
