import { z } from "zod";

export const regionSchema = z.object({
  code: z.string().regex(/^\d{13}$/, "Выберите регион из списка"),
  name: z.string().min(2).max(120),
});

export const vacancyInputSchema = z.object({
  title: z.string().trim().min(2, "Укажите должность").max(120),
  region: regionSchema,
  offeredSalaryRub: z.coerce
    .number()
    .int("Укажите зарплату целым числом")
    .min(10_000, "Зарплата должна быть не меньше 10 000 ₽")
    .max(2_000_000, "Проверьте указанную зарплату"),
});

export const positionSchema = z.enum([
  "below_market",
  "in_market",
  "above_market",
]);

export const marketSourceIdSchema = z.enum(["trudvsem", "hh", "superjob", "demo"]);

export const marketSourceSummarySchema = z.object({
  id: marketSourceIdSchema,
  name: z.string(),
  totalFound: z.number().int().nonnegative(),
  salarySampleSize: z.number().int().nonnegative(),
  url: z.string().url(),
});

export const competitorSchema = z.object({
  id: z.string(),
  source: marketSourceIdSchema.default("trudvsem"),
  employer: z.string(),
  title: z.string(),
  salaryMin: z.number().int(),
  salaryMax: z.number().int(),
  url: z.string().url(),
});

export const benchmarkSchema = z.object({
  dataMode: z.enum(["live", "demo"]),
  totalFound: z.number().int().nonnegative(),
  salarySampleSize: z.number().int().nonnegative(),
  medianSalary: z.number().int().nullable(),
  marketMin: z.number().int().nullable(),
  marketMax: z.number().int().nullable(),
  percentile: z.number().min(0).max(100).nullable(),
  position: positionSchema.nullable(),
  insufficientData: z.boolean(),
  query: z.string(),
  regionName: z.string(),
  fetchedAt: z.string().datetime(),
  sourceUrl: z.string().url(),
  sources: z.array(marketSourceSummarySchema).default([]),
  excludedWithoutRange: z.number().int().nonnegative(),
  competitors: z.array(competitorSchema).max(8),
});

export const monitorSchema = vacancyInputSchema.extend({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  status: z.enum(["active", "paused"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  nextRunAt: z.string().datetime(),
});

export const dashboardSchema = z.object({
  monitor: monitorSchema,
  benchmark: benchmarkSchema.nullable(),
});

export const meSchema = z.object({
  user: z.object({
    id: z.string(),
    firstName: z.string(),
  }),
  company: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
  developmentIdentity: z.boolean(),
});

export const errorSchema = z.object({
  code: z.string(),
  detail: z.string(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
});

export type VacancyInput = z.infer<typeof vacancyInputSchema>;
export type Position = z.infer<typeof positionSchema>;
export type MarketSourceId = z.infer<typeof marketSourceIdSchema>;
export type MarketSourceSummary = z.infer<typeof marketSourceSummarySchema>;
export type Competitor = z.infer<typeof competitorSchema>;
export type Benchmark = z.infer<typeof benchmarkSchema>;
export type Monitor = z.infer<typeof monitorSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
export type Me = z.infer<typeof meSchema>;
export type ApiError = z.infer<typeof errorSchema>;
