# Архитектура MVP и работа в MAX

## Архитектурное решение

Остаёмся в существующем модульном монолите: React Mini App, Django/DRF и
PostgreSQL. Django проверяет MAX identity, обращается к «Работе России», считает
benchmark, хранит мониторинги и отправляет сообщения через Bot API. Отдельные
микросервисы, брокер сообщений и универсальный framework интеграций для одной
внешней системы не нужны.

```text
MAX user ── Bridge initData ──> React Mini App ── session/API ──> Django
   │                                                            │
   │                                                            ├─> PostgreSQL
   │                                                            └─> trudvsem GET
   │
MAX channel <── Bot API message ── sender job <── Alert/Outbox <─┘
     └──────────── signed webhook/command ──────────────────────> Django
```

## Ответственность компонентов

| Компонент | Ответственность |
|---|---|
| MAX Bot | Точка входа, короткий опрос/команды, событие привязки чата, пост апдейта, кнопка Mini App |
| MAX Bridge | `initData`, контекст запуска, BackButton, deep-link/open-app |
| React | Форма одной вакансии, dashboard, состояние привязки канала, loading/empty/error |
| Django/DRF | Проверка MAX, session/CSRF, права компании, trudvsem adapter, benchmark, webhook, scheduler/sender |
| PostgreSQL | Пользователи, компании, мониторинг, срезы, chat binding, webhook dedupe и outbox |

## Авторизация через MAX

1. React читает только исходную строку `window.WebApp.initData`.
2. `POST /api/auth/max/` проверяет формат, единственный `hash`, HMAC-SHA256 по
   актуальному алгоритму MAX, freshness `auth_date` и constant-time equality.
3. Backend находит или создаёт `User` по `max_user_id` и открывает серверную
   сессию в HttpOnly Secure cookie; state-changing запросы защищены CSRF.
4. `initDataUnsafe`, переданный клиентом MAX ID и URL-параметры не являются
   доказательством личности.
5. DEBUG-only вход разрешён только локально, явно маркирован в UI и физически
   недоступен при `DEBUG=false`.

Токен бота используется только backend и никогда не попадает в Vite bundle,
ответ API, deep-link, лог или fixture.

## Компания и права

Первый вошедший пользователь создаёт компанию и становится owner. Для Must
Have достаточно одной компании и одного owner; модель membership оставляет
безопасный путь к Should Have с несколькими участниками.

| Действие | Неавторизованный | Member | Owner | Django admin |
|---|---:|---:|---:|---:|
| Выполнить разовый benchmark | Нет | Да | Да | Support-only |
| Смотреть мониторинг компании | Нет | Да | Да | Support-only |
| Изменять вакансию | Нет | Нет | Да | Support-only |
| Привязать/отвязать канал | Нет | Нет | Да | Support-only |
| Запустить/остановить мониторинг | Нет | Нет | Да | Support-only |

Каждая проверка выполняется backend по объекту компании. Скрытая кнопка в React
не является авторизацией.

## Привязка канала MAX

Выбор произвольного `chat_id` из формы запрещён. Безопасный поток:

1. owner добавляет бота в целевой канал/чат с правом публикации;
2. из этого контекста отправляется документированная команда/событие привязки;
3. webhook проходит проверку секрета и дедупликацию, backend сохраняет pending
   chat context и выдаёт короткий одноразовый код либо непрозрачный token;
4. авторизованный owner подтверждает привязку в Mini App;
5. backend отправляет тестовый пост; только успех переводит binding в `active`;
6. отзыв прав, permanent 4xx или явная команда переводят binding в `disabled`.

Точный тип события и доступность публикации в канал нужно подтвердить актуальной
документацией и реальным spike `MAX-002`; отсутствие этого capability блокирует
Must-сценарий, а не маскируется личным сообщением.

## Интеграция с «Работой России»

### Запрос

Backend формирует source-specific GET по коду региона и тексту должности. У
клиента есть явные connect/read timeout, стабильный User-Agent, ограничение
страниц и общий budget времени. React никогда не вызывает источник напрямую.

Первый результат формируется живым запросом. Recorded fixtures используются
только в автоматических тестах и резервной демонстрации с видимой меткой.

### Нормализация

Внутренний `MarketVacancy` не повторяет весь payload поставщика. Нужны:

- внешний ID и canonical URL;
- нормализованные title, region и employer name;
- salary min/max, currency и pay period;
- source updated time и fetch time.

Контактные данные и сырой ответ по умолчанию не хранятся. Несовпадающая валюта,
неизвестный период оплаты и отсутствующая граница получают явную причину
исключения из зарплатной выборки.

### Расчёт

Для пригодных месячных RUB-диапазонов:

```text
midpoint_i = (salary_min_i + salary_max_i) / 2
median = median(midpoint_i)
percentile = count(midpoint_i <= offered_salary) / N * 100
market_min = min(salary_min_i)
market_max = max(salary_max_i)
```

Результат всегда содержит `total_found`, `salary_sample_size`, query, region,
`fetched_at` и exclusion counts. Ни одна оценка не показывается без размера
выборки. Порог «недостаточно данных» фиксируется конфигурацией и тестами.

Список конкурентов агрегируется по публичному employer name и содержит ссылки
на исходные вакансии. Он не интерпретируется как полный список нанимающих
компаний региона.

## Снимки и алерты

Первый успешный расчёт создаёт `MarketSnapshot`. Плановый job пересчитывает
активный мониторинг тем же сервисом. Must Have использует один фиксированный
период и одно правило существенного изменения, например:

- изменилась медиана не меньше настроенного порога; или
- появились работодатели, которых не было в предыдущем срезе; или
- предложение перешло между `below_market`, `in_market`, `above_market`.

Порог утверждается как продуктовая константа до реализации. Один новый snapshot
создаёт не более одного `Alert` с уникальным dedupe key. Отправка идёт после
commit, с timeout, bounded retry и учётом документированного rate limit MAX.

Шаблон сообщения:

```text
Продавец · Московская область
Медиана: 72 000 ₽ (было 68 000 ₽)
Ваше предложение: 65 000 ₽ — ниже рынка
Новые конкуренты: 3
[Открыть дашборд]
```

## Основные сущности

| Сущность | Ключевые поля и ограничения |
|---|---|
| `User` | `max_user_id` unique, разрешённые профильные поля, timestamps |
| `Company` | name, owner/memberships, timestamps |
| `CompanyMembership` | role=`owner/member`, unique `(company,user)` |
| `VacancyMonitor` | company, title/query, region code/name, offered salary, status; одна active в Must |
| `BotConversation` | MAX user/chat context, current step, expires_at, draft values; одна active на user |
| `MarketSnapshot` | monitor, totals, median/min/max, percentile, position, fetched_at, source metadata |
| `SnapshotCompetitor` | snapshot, source vacancy ID/URL, employer, title, salary fields |
| `MaxChatBinding` | company, opaque chat ID, status, verified_at; одна active в Must |
| `MaxWebhookEvent` | external event ID unique, received/processed timestamps |
| `Alert` | snapshot, binding, payload, dedupe key unique, status, attempts, next attempt, error code |

Деньги хранятся как integer minor/whole RUB по выбранному контракту, не float.
Время — timezone-aware, API — ISO 8601.

## REST API MVP

| Группа | Endpoints |
|---|---|
| Session | `POST /api/auth/max/`, `POST /api/auth/dev/` DEBUG-only, `POST /api/auth/logout/`, `GET /api/me/` |
| Company | `GET/POST /api/companies/`, `GET/PATCH /api/companies/{id}/` |
| Monitor | `GET/POST /api/monitors/`, `GET/PATCH /api/monitors/{id}/`, `POST .../{id}/benchmark/` |
| Dashboard | `GET /api/monitors/{id}/dashboard/` |
| MAX | `POST /api/max/webhook/`, confirm/disable/test binding actions |

Списки имеют bounded pagination. Ошибка имеет стабильную форму
`{"code":"...","detail":"...","fields":{...}}` и различает
400/401/403/404/409/429/502/503.

Webhook обрабатывает и диалог ввода: `/start`/кнопка начинает или продолжает
сессию, затем принимаются title, region и salary. Каждое состояние имеет
`cancel`, expiry и идемпотентную обработку повторного события. После третьего
ответа создаётся draft `VacancyMonitor`, а кнопка открывает Mini App для
подтверждения и запуска benchmark.

## Frontend-маршруты

| Маршрут | Экран |
|---|---|
| `/` | Session bootstrap и сводка |
| `/company` | Минимальное имя компании |
| `/vacancy` | Должность, регион, предлагаемая зарплата |
| `/vacancy/:id/dashboard` | Числа, распределение, выборка и конкуренты |
| `/vacancy/:id/channel` | Инструкция, pending binding, test post, отключение |

Каждый data-driven экран имеет loading, empty, retryable source error,
forbidden, insufficient-data и success. График не является единственным носителем
значения: рядом есть текст, числа и доступные labels.

## Локальная и реальная проверка

### Локально

- unit/request tests проверки MAX с фиксированными векторами;
- HTTP fake/recorded fixtures для trudvsem и Bot API;
- DEBUG identity с постоянным предупреждением;
- deterministic benchmark tests и browser E2E.

### В реальном MAX

- публичный HTTPS, `DEBUG=false`, secrets вне Git;
- вход по валидному `initData`, отказ для tampered/expired данных;
- живой trudvsem request из production-like backend;
- добавление бота и доказанная привязка тестового канала;
- один тестовый и один change alert;
- deep-link, BackButton, safe area и повторное открытие на mobile и web/desktop.

## Безопасность и наблюдаемость

- не логировать `initData`, bot token, webhook secret, chat ID, MAX user ID или
  коммерческие поля вакансии целиком;
- проверять webhook secret, schema и unique event ID;
- rate-limit auth, benchmark, webhook и test-message endpoints;
- не принимать source URL, chat ID или company ID как доверенные клиентские
  полномочия;
- structured logs и метрики для auth, source latency/error/schema drift,
  sample size, snapshot, alert delivery/retry;
- audit owner-действий: изменение зарплаты, привязка канала, включение/выключение
  мониторинга — без secret payload.

## Границы расширения

Несколько вакансий, история, участники и реестр МСП добавляются после Must. Для
реестра МСП допустима отдельная заранее загруженная bulk-таблица с provenance и
датой версии; она не должна менять trudvsem adapter или блокировать MVP.
