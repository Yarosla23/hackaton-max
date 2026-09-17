import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Dashboard } from "@hackathon-max/contracts";

import { SalaryPosition } from "./App";

const dashboard: Dashboard = {
  monitor: {
    id: "0cfccbd0-a1cb-46db-b4f2-f680cb51eb01",
    companyId: "3f243eaa-d855-41ed-b907-a041ebfa9a82",
    title: "Продавец-консультант",
    region: { code: "7700000000000", name: "Москва" },
    offeredSalaryRub: 70_000,
    status: "active",
    createdAt: "2026-09-17T12:00:00.000Z",
    updatedAt: "2026-09-17T12:00:00.000Z",
    nextRunAt: "2026-09-18T12:00:00.000Z",
  },
  benchmark: {
    dataMode: "demo",
    totalFound: 7,
    salarySampleSize: 7,
    medianSalary: 72_000,
    marketMin: 47_000,
    marketMax: 99_000,
    percentile: 43,
    position: "in_market",
    insufficientData: false,
    query: "Продавец-консультант",
    regionName: "Москва",
    fetchedAt: "2026-09-17T12:00:00.000Z",
    sourceUrl: "https://trudvsem.ru/opendata/api",
    sources: [
      {
        id: "demo",
        name: "Демо-выборка",
        totalFound: 7,
        salarySampleSize: 7,
        url: "https://trudvsem.ru/opendata/api",
      },
    ],
    excludedWithoutRange: 0,
    competitors: [],
  },
};

describe("SalaryPosition", () => {
  it("labels demo data and the offered salary", () => {
    render(<SalaryPosition dashboard={dashboard} />);
    expect(screen.getByText("Демо-данные")).toBeInTheDocument();
    expect(screen.getByLabelText(/Предложение 70/)).toBeInTheDocument();
    expect(screen.getByText("В рынке")).toBeInTheDocument();
    expect(screen.getByText("Демо-выборка")).toBeInTheDocument();
    expect(screen.getByText("7 / 7")).toBeInTheDocument();
  });
});
