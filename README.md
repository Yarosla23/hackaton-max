# Рынок рядом

MAX Mini App для малого бизнеса: владелец задаёт должность, регион и зарплату,
приложение сравнивает предложение с вакансиями «Работы России», HeadHunter и
опционально SuperJob, затем сохраняет ежедневный мониторинг.

Проект переписан на один TypeScript-стек без Django и PostgreSQL:

- React + Vite — статический Mini App;
- Hono + Zod — API и проверяемые контракты;
- YDB Serverless — пользователи, вакансии и рыночные снимки;
- две Yandex Cloud Functions — HTTP API и webhook/плановый worker;
- MAX Bridge и Bot API — авторизация и точка входа.

## Что уже работает

1. MAX `initData` проверяется на backend через HMAC и срок действия.
2. В локальной разработке доступна отдельная явно помеченная dev identity.
3. Пользователь создаёт одну активную вакансию и запускает benchmark.
4. Backend параллельно получает до 100 вакансий от каждого источника, исключает
   неполные/не-RUB вилки и межплощадочные дубликаты, затем рассчитывает медиану,
   диапазон, перцентиль и позицию предложения.
5. Недоступность одной площадки не блокирует расчёт, если ответил другой
   источник; UI показывает источник каждой вакансии и состав выборки.
6. Снимок сохраняется в YDB, dashboard переживает перезапуск API.
7. MAX webhook проверяет secret, на `bot_started` привязывает личный чат
   пользователя и отправляет кнопку Mini App.
8. Worker обновляет просроченные мониторинги и пишет в этот чат, если позиция
   предложения изменилась или медиана рынка сдвинулась минимум на 5%.

Демо-источник используется только локально и всегда видимо подписан в UI.
Первый расчёт уведомление не создаёт. Публикация в групповой канал и его
безопасная привязка не входят в текущий срез: сейчас alerts приходят только в
личный чат с ботом, подтверждённый событием `bot_started`.

## Локальный запуск

Нужны Docker и Docker Compose:

```bash
docker compose up --build
```

Адреса:

- Mini App: <http://localhost:5173>;
- API health: <http://localhost:8000/health>;
- YDB UI: <http://localhost:8765>.

По умолчанию Compose использует воспроизводимый `MARKET_SOURCE=demo`. Для
живого API:

```bash
MARKET_SOURCE=live docker compose up --build
```

Остановка:

```bash
docker compose down
```

Локальная YDB намеренно работает в RAM-режиме: это воспроизводимая среда для
разработки, и её тестовые данные сбрасываются при пересоздании YDB-контейнера.
Production-данные хранятся только в YDB Serverless.

## Разработка без Docker

Требуется Node.js 20.19+:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Для memory-backed API:

```bash
DEV_AUTH_ENABLED=true MARKET_SOURCE=demo npm run dev
```

Frontend запускается отдельно:

```bash
npm run dev --workspace frontend -- --host 0.0.0.0
```

## Переменные production

| Переменная | Значение |
|---|---|
| `NODE_ENV` | `production` |
| `DATA_STORE` | `ydb` |
| `YDB_CONNECTION_STRING` | endpoint и database YDB Serverless |
| `YDB_AUTH_MODE` | `metadata` для service account функции |
| `MARKET_SOURCE` | `live` |
| `HH_USER_AGENT` | название приложения и контакт разработчика для HH |
| `HH_ACCESS_TOKEN` | опциональный access token HH; рекомендуется для стабильного production-поиска |
| `SUPERJOB_API_KEY` | опциональный `X-Api-App-Id`; при отсутствии SuperJob не вызывается |
| `BOT_TOKEN` | токен бота MAX, только в окружении функции |
| `MAX_WEBHOOK_SECRET` | secret подписки MAX |
| `MAX_BOT_USERNAME` | имя бота без `@` |
| `FRONTEND_ORIGIN` | точный HTTPS origin статического сайта |
| `DEV_AUTH_ENABLED` | обязательно `false` |

Секреты нельзя помещать в Vite variables, Git или Terraform state.

## Сборка для Yandex Cloud

```bash
npm run build
```

Результат:

- `frontend/dist/` — загрузить в публичный Object Storage bucket как статический
  сайт;
- `backend/build/api-function.js` — функция с entrypoint
  `api-function.handler`;
- `backend/build/worker-function.js` — функция с entrypoint
  `worker-function.handler`.

API Gateway направляет `/api/*` и `/health` в API function, `/max/webhook` — в
worker function, а остальные пути — в статический bucket. Готовый шаблон:
[`infra/api-gateway.yaml.example`](infra/api-gateway.yaml.example). Trigger Timer вызывает worker раз в сутки. Обе функции получают
service account с минимальной ролью записи в YDB. После публикации нужно:

1. один раз вызвать приватную API function после создания версии:
   `yc serverless function invoke <API_FUNCTION_ID> -d '{"action":"migrate"}'`;
2. настроить HTTPS URL Mini App в MAX;
3. создать `POST /subscriptions` на публичный URL `/max/webhook`, передав тот же
   `MAX_WEBHOOK_SECRET`;
4. пройти smoke: событие `bot_started`, вход из MAX, создание вакансии, живой
   benchmark, повторный timer-запуск после изменения рынка и личный alert.

Схема и границы компонентов описаны в
[`docs/planning/04-architecture.md`](docs/planning/04-architecture.md).
