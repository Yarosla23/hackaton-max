import { z } from "zod";

const booleanValue = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(10).optional(),
);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8000),
    FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
    DATA_STORE: z.enum(["memory", "ydb"]).default("memory"),
    YDB_CONNECTION_STRING: z.string().min(1).optional(),
    YDB_AUTH_MODE: z.enum(["anonymous", "metadata", "environment"]).default("anonymous"),
    MARKET_SOURCE: z.enum(["live", "demo"]).default("live"),
    TRUDVSEM_API_URL: z
      .string()
      .url()
      .default("https://opendata.trudvsem.ru/api/v1/vacancies"),
    HH_API_URL: z.string().url().default("https://api.hh.ru/"),
    HH_USER_AGENT: z.string().min(5).optional(),
    HH_ACCESS_TOKEN: optionalSecret,
    SUPERJOB_API_URL: z.string().url().default("https://api.superjob.ru/2.0/"),
    SUPERJOB_API_KEY: optionalSecret,
    BOT_TOKEN: z.string().min(20).optional(),
    MAX_WEBHOOK_SECRET: z.string().min(16).max(256).regex(/^[A-Za-z0-9_-]+$/).optional(),
    MAX_BOT_USERNAME: z.string().regex(/^[A-Za-z0-9_]+$/).optional(),
    DEV_AUTH_ENABLED: booleanValue,
    DEV_USER_ID: z.string().default("local-user"),
    DEV_USER_NAME: z.string().default("Ярослав"),
  })
  .superRefine((environment, context) => {
    if (environment.DATA_STORE === "ydb" && !environment.YDB_CONNECTION_STRING) {
      context.addIssue({
        code: "custom",
        path: ["YDB_CONNECTION_STRING"],
        message: "YDB_CONNECTION_STRING is required when DATA_STORE=ydb",
      });
    }

    if (environment.NODE_ENV === "production" && environment.DEV_AUTH_ENABLED) {
      context.addIssue({
        code: "custom",
        path: ["DEV_AUTH_ENABLED"],
        message: "Development authentication must be disabled in production",
      });
    }

    if (environment.NODE_ENV === "production") {
      if (environment.DATA_STORE !== "ydb") {
        context.addIssue({ code: "custom", path: ["DATA_STORE"], message: "Production requires YDB" });
      }
      if (environment.MARKET_SOURCE !== "live") {
        context.addIssue({ code: "custom", path: ["MARKET_SOURCE"], message: "Production requires the live market source" });
      }
      if (!environment.HH_USER_AGENT) {
        context.addIssue({ code: "custom", path: ["HH_USER_AGENT"], message: "HH_USER_AGENT is required in production" });
      }
      if (!environment.BOT_TOKEN) {
        context.addIssue({ code: "custom", path: ["BOT_TOKEN"], message: "BOT_TOKEN is required in production" });
      }
      if (!environment.MAX_WEBHOOK_SECRET) {
        context.addIssue({ code: "custom", path: ["MAX_WEBHOOK_SECRET"], message: "MAX_WEBHOOK_SECRET is required in production" });
      }
      if (!environment.MAX_BOT_USERNAME) {
        context.addIssue({ code: "custom", path: ["MAX_BOT_USERNAME"], message: "MAX_BOT_USERNAME is required in production" });
      }
      if (!environment.FRONTEND_ORIGIN.startsWith("https://")) {
        context.addIssue({ code: "custom", path: ["FRONTEND_ORIGIN"], message: "Production frontend must use HTTPS" });
      }
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

export function readEnvironment(
  values: Record<string, string | undefined> = process.env,
): Environment {
  return environmentSchema.parse(values);
}
