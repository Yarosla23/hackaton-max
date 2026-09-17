import { z } from "zod";

import type { Environment } from "./config.js";
import type { AppStore, StoredMonitor } from "./store.js";
import type { Benchmark } from "@hackathon-max/contracts";

const botStartedSchema = z.object({
  update_type: z.literal("bot_started"),
  chat_id: z.union([z.string(), z.number()]).transform(String),
  user: z.object({
    user_id: z.union([z.string(), z.number()]).transform(String),
    name: z.string().trim().min(1).max(120),
  }),
});

type MaxMessage = {
  text: string;
  attachments?: Array<{
    type: "inline_keyboard";
    payload: {
      buttons: Array<Array<{ type: "link"; text: string; url: string }>>;
    };
  }>;
};

function miniAppUrl(environment: Environment): string | null {
  return environment.MAX_BOT_USERNAME
    ? `https://max.ru/${environment.MAX_BOT_USERNAME}?startapp`
    : null;
}

async function sendMaxMessage(
  chatId: string,
  message: MaxMessage,
  environment: Environment,
): Promise<boolean> {
  if (!environment.BOT_TOKEN) return false;

  const url = new URL("https://platform-api2.max.ru/messages");
  url.searchParams.set("chat_id", chatId);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: environment.BOT_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`MAX Bot API responded with ${response.status}`);
  }
  return true;
}

async function sendWelcome(chatId: string, environment: Environment): Promise<boolean> {
  const appUrl = miniAppUrl(environment);
  return sendMaxMessage(
    chatId,
    {
      text: "Сравните зарплату вакансии с рынком и включите ежедневный мониторинг.",
      ...(appUrl
        ? {
            attachments: [
              {
                type: "inline_keyboard" as const,
                payload: {
                  buttons: [
                    [
                      {
                        type: "link" as const,
                        text: "Открыть Рынок рядом",
                        url: appUrl,
                      },
                    ],
                  ],
                },
              },
            ],
          }
        : {}),
    },
    environment,
  );
}

function formatRubles(value: number | null): string {
  return value === null ? "нет данных" : `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

const positionLabels: Record<NonNullable<Benchmark["position"]>, string> = {
  below_market: "ниже рынка",
  in_market: "в рынке",
  above_market: "выше рынка",
};

export async function sendMarketAlert(
  chatId: string,
  monitor: StoredMonitor,
  previous: Benchmark,
  current: Benchmark,
  environment: Environment,
): Promise<boolean> {
  const appUrl = miniAppUrl(environment);
  const position = current.position ? positionLabels[current.position] : "недостаточно данных";
  return sendMaxMessage(
    chatId,
    {
      text: [
        `Рынок изменился: ${monitor.title}, ${monitor.region.name}`,
        `Медиана: ${formatRubles(previous.medianSalary)} → ${formatRubles(current.medianSalary)}`,
        `Ваше предложение: ${formatRubles(monitor.offeredSalaryRub)} — ${position}.`,
      ].join("\n"),
      ...(appUrl
        ? {
            attachments: [
              {
                type: "inline_keyboard" as const,
                payload: {
                  buttons: [
                    [
                      {
                        type: "link" as const,
                        text: "Посмотреть рынок",
                        url: appUrl,
                      },
                    ],
                  ],
                },
              },
            ],
          }
        : {}),
    },
    environment,
  );
}

export async function handleMaxWebhook(
  request: Request,
  environment: Environment,
  store: AppStore,
): Promise<Response> {
  if (!environment.MAX_WEBHOOK_SECRET) {
    return Response.json({ code: "webhook_not_configured" }, { status: 503 });
  }
  if (request.headers.get("x-max-bot-api-secret") !== environment.MAX_WEBHOOK_SECRET) {
    return Response.json({ code: "unauthorized" }, { status: 401 });
  }

  const payload: unknown = await request.json();
  const event = botStartedSchema.safeParse(payload);
  if (event.success) {
    const userId = event.data.user.user_id;
    await store.getOrCreateWorkspace({
      id: userId,
      firstName: event.data.user.name,
      development: false,
    });
    await store.setNotificationChat(userId, event.data.chat_id);
    await sendWelcome(event.data.chat_id, environment);
  }
  return Response.json({ ok: true });
}
