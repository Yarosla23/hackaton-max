import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import {
  dashboardSchema,
  errorSchema,
  meSchema,
  monitorSchema,
  vacancyInputSchema,
} from "@hackathon-max/contracts";

import type { Environment } from "./config.js";
import { calculateBenchmark } from "./domain/benchmark.js";
import {
  AuthenticationError,
  type Identity,
  validateMaxInitData,
} from "./domain/max-auth.js";
import { MarketSourceError, type MarketSource } from "./market-source.js";
import type { AppStore, StoredMonitor } from "./store.js";

export type AppDependencies = {
  environment: Environment;
  store: AppStore;
  marketSource: MarketSource;
};

type AppBindings = { Variables: { identity: Identity } };

function jsonError(code: string, detail: string, status: 400 | 401 | 404 | 502 | 500) {
  return { body: errorSchema.parse({ code, detail }), status } as const;
}

function authenticate(request: Request, environment: Environment): Identity {
  if (environment.DEV_AUTH_ENABLED) {
    return {
      id: request.headers.get("x-dev-user-id") ?? environment.DEV_USER_ID,
      firstName: request.headers.get("x-dev-user-name") ?? environment.DEV_USER_NAME,
      development: true,
    };
  }

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Max ") || !environment.BOT_TOKEN) {
    throw new AuthenticationError("MAX authorization is required");
  }

  return validateMaxInitData(authorization.slice(4), environment.BOT_TOKEN);
}

export function createApp({ environment, store, marketSource }: AppDependencies) {
  const app = new Hono<AppBindings>();

  app.use(
    "/api/*",
    cors({
      origin: environment.FRONTEND_ORIGIN,
      allowHeaders: ["Authorization", "Content-Type", "X-Dev-User-Id", "X-Dev-User-Name"],
      allowMethods: ["GET", "PUT", "POST", "OPTIONS"],
      maxAge: 600,
    }),
  );

  app.get("/health", async (context) => {
    await store.health();
    return context.json({ status: "ok" });
  });

  app.use("/api/*", async (context, next) => {
    try {
      context.set("identity", authenticate(context.req.raw, environment));
      await next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        const response = jsonError("unauthorized", "Откройте приложение внутри MAX", 401);
        return context.json(response.body, response.status);
      }
      throw error;
    }
  });

  app.get("/api/me", async (context) => {
    const identity = context.get("identity");
    return context.json(meSchema.parse(await store.getOrCreateWorkspace(identity)));
  });

  app.get("/api/dashboard", async (context) => {
    const identity = context.get("identity");
    const dashboard = await store.getDashboard(identity.id);
    if (!dashboard) {
      const response = jsonError("monitor_not_found", "Сначала добавьте вакансию", 404);
      return context.json(response.body, response.status);
    }
    return context.json(dashboardSchema.parse(dashboard));
  });

  app.put(
    "/api/monitor",
    zValidator("json", vacancyInputSchema, (result, context) => {
      if (result.success) return;
      const response = jsonError("validation_error", "Проверьте данные вакансии", 400);
      return context.json(response.body, response.status);
    }),
    async (context) => {
      const identity = context.get("identity");
      await store.getOrCreateWorkspace(identity);
      const monitor = await store.saveMonitor(identity.id, context.req.valid("json"));
      return context.json(monitorSchema.parse(monitor), 201);
    },
  );

  app.post("/api/monitor/benchmark", async (context) => {
    const identity = context.get("identity");
    const dashboard = await store.getDashboard(identity.id);
    if (!dashboard) {
      const response = jsonError("monitor_not_found", "Сначала добавьте вакансию", 404);
      return context.json(response.body, response.status);
    }

    const monitor: StoredMonitor = { ...dashboard.monitor, ownerUserId: identity.id };
    const sample = await marketSource.fetch(monitor);
    const benchmark = calculateBenchmark(monitor, sample);
    await store.saveBenchmark(monitor, benchmark);
    return context.json(dashboardSchema.parse({ monitor, benchmark }));
  });

  app.notFound((context) => {
    const response = jsonError("not_found", "Маршрут не найден", 404);
    return context.json(response.body, response.status);
  });

  app.onError((error, context) => {
    if (error instanceof MarketSourceError) {
      const response = jsonError("market_source_unavailable", error.message, 502);
      return context.json(response.body, response.status);
    }
    if (error instanceof HTTPException) {
      return error.getResponse();
    }
    console.error("Unhandled request error", error);
    const response = jsonError("internal_error", "Не удалось выполнить запрос", 500);
    return context.json(response.body, response.status);
  });

  return app;
}
