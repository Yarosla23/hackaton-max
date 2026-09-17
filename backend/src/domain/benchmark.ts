import type {
  Benchmark,
  Competitor,
  MarketSourceSummary,
  Position,
  VacancyInput,
} from "@hackathon-max/contracts";

export type MarketVacancy = Competitor;

export type MarketSample = {
  dataMode: "live" | "demo";
  totalFound: number;
  vacancies: MarketVacancy[];
  sourceUrl: string;
  sources: MarketSourceSummary[];
  fetchedAt: string;
};

const MINIMUM_SAMPLE_SIZE = 5;

function median(values: number[]): number {
  const middle = Math.floor(values.length / 2);
  const right = values[middle];

  if (right === undefined) {
    throw new Error("Cannot calculate a median for an empty sample");
  }

  if (values.length % 2 === 1) {
    return right;
  }

  const left = values[middle - 1];
  if (left === undefined) {
    throw new Error("Cannot calculate an even median without two middle values");
  }

  return Math.round((left + right) / 2);
}

function classifyPosition(offeredSalary: number, marketMedian: number): Position {
  if (offeredSalary < marketMedian * 0.9) {
    return "below_market";
  }

  if (offeredSalary > marketMedian * 1.1) {
    return "above_market";
  }

  return "in_market";
}

export function calculateBenchmark(
  monitor: VacancyInput,
  sample: MarketSample,
): Benchmark {
  const midpoints = sample.vacancies
    .map((vacancy) => Math.round((vacancy.salaryMin + vacancy.salaryMax) / 2))
    .sort((left, right) => left - right);
  const insufficientData = midpoints.length < MINIMUM_SAMPLE_SIZE;
  const marketMedian = midpoints.length > 0 ? median(midpoints) : null;

  return {
    dataMode: sample.dataMode,
    totalFound: sample.totalFound,
    salarySampleSize: midpoints.length,
    medianSalary: marketMedian,
    marketMin:
      sample.vacancies.length > 0
        ? Math.min(...sample.vacancies.map((vacancy) => vacancy.salaryMin))
        : null,
    marketMax:
      sample.vacancies.length > 0
        ? Math.max(...sample.vacancies.map((vacancy) => vacancy.salaryMax))
        : null,
    percentile:
      midpoints.length > 0
        ? Math.round(
            (midpoints.filter((salary) => salary <= monitor.offeredSalaryRub).length /
              midpoints.length) *
              100,
          )
        : null,
    position:
      marketMedian === null
        ? null
        : classifyPosition(monitor.offeredSalaryRub, marketMedian),
    insufficientData,
    query: monitor.title,
    regionName: monitor.region.name,
    fetchedAt: sample.fetchedAt,
    sourceUrl: sample.sourceUrl,
    sources: sample.sources,
    excludedWithoutRange: Math.max(0, sample.totalFound - sample.vacancies.length),
    competitors: sample.vacancies.slice(0, 8),
  };
}
