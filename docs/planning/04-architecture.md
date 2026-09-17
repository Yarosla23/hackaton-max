# Архитектура приложения

## Рабочая схема

```text
                         build
React + Vite ─────────────────────────> Object Storage (static HTTPS)
    │                                           │
    │ MAX Bridge initData                       │ opens inside MAX
    v                                           v
API Gateway ── /api/* ──> API Cloud Function <── MAX Mini App
    │                         │
    │                         ├── verify initData (HMAC + freshness)
    │                         ├── Работа России API
    │                         ├── HeadHunter API
    │                         ├── SuperJob API (если задан ключ)
    │                         └── YDB Serverless
    │                                  ▲
    └── /max/webhook ─> Worker Function│
                         ▲       │      │
                         │       └──────┘ daily refresh
                    MAX Bot API <── personal market alert
                         ▲
                         └── Timer Trigger (раз в сутки)
```

Vite не является сервером: он собирает frontend в статические файлы. Hono живёт
в Cloud Function. Zod проверяет клиентский ввод, ответы внешнего API и ответы
собственного API. YDB подключается только из backend через `@ydbjs/*`.

## Почему не Next.js и не Django

Mini App не требует SSR, серверных React-компонентов, admin UI или тяжёлого ORM.
Статика Vite дешевле и проще кэшируется. Одна небольшая Hono-функция закрывает
HTTP API, вторая отделяет потенциально повторяемые webhook/timer-вызовы. Один
TypeScript-стек сокращает дублирование DTO и даёт общие Zod-контракты.

## Данные YDB

| Таблица | Назначение | Ключ |
|---|---|---|
| `users` | MAX identity и созданная компания | `user_id` |
| `vacancy_monitors` | одна активная вакансия пользователя, следующий запуск | `(owner_user_id, monitor_id)` |
| `market_snapshots` | неизменяемые результаты расчёта | `(monitor_id, fetched_at, snapshot_id)` |
| `notification_chats` | подтверждённый личный чат пользователя | `user_id` |

Индекс `due_monitors(status, next_run_at)` нужен worker, чтобы брать только
просроченные активные мониторинги. Денежные значения хранятся как целые рубли,
время — ISO 8601 UTC.

## HTTP-контракт

| Метод | Path | Результат |
|---|---|---|
| `GET` | `/health` | доступность API и YDB |
| `GET` | `/api/me` | подтверждённый пользователь и компания |
| `GET` | `/api/dashboard` | монитор и последний снимок |
| `PUT` | `/api/monitor` | создать или изменить вакансию |
| `POST` | `/api/monitor/benchmark` | получить рынок и сохранить снимок |
| `POST` | `/max/webhook` | принять подписанный event MAX |

Ошибка имеет стабильную форму `code/detail/fields`. В production запросы
`/api/*` принимаются только с `Authorization: Max <initData>`. Dev identity
запрещена конфигурационной проверкой при `NODE_ENV=production`.

## Расчёт benchmark

Источники опрашиваются параллельно. Отказ одного источника допускается, пока
хотя бы один вернул корректный ответ. Ответы приводятся к общему контракту,
межплощадочные дубликаты удаляются по работодателю, должности и вилке.

Для каждой полной RUB-вилки берётся midpoint. Затем считаются медиана,
минимальная/максимальная граница и процент midpoint, не превышающих предложение.
Позиция считается рыночной в диапазоне ±10% от медианы. Выборка меньше пяти
записей явно маркируется недостаточной; UI всегда показывает объём и источник.

## Состояние после текущего среза

Реализованы Mini App, auth, YDB, benchmark, сохранение, плановое обновление,
welcome webhook и личные alerts. `bot_started` связывает `user_id` с личным
`chat_id`; worker уведомляет только при смене позиции или изменении медианы на
5% и более. Следующая независимая функция — безопасная привязка группового
канала и dedupe webhook-событий. Личный alert не называется публикацией в канал.
