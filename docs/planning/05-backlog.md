# Backlog

Карточки ниже заменяют прежний план маркетплейса вакансий. Оценки — активная
работа одного специалиста с тестами и review, без ожидания выдачи MAX-доступов,
модерации и доступности внешнего API.

## P0 — Must Have

### DISC-001 — Проверить решение и baseline

- **Результат:** подтверждены текущий способ сравнения рынка, право менять
  условия и источник дат `published_at`/`hired_at` у 5 владельцев/HR.
- **Объём:** problem interviews, walkthrough прототипа, baseline и decision log;
  макроцифра 1,8 млн хранится отдельно от пользовательского evidence.
- **Приёмка:** есть формулировки jobs/pains, минимум 3 потенциальных пилотанта и
  операционное определение двух продуктовых метрик.
- **Проверка:** обезличенные заметки и traceability решений.
- **Оценка:** 10–16 ч.

### MAX-001 — Зарегистрировать бота и HTTPS Mini App

- **Результат:** согласован неизменяемый ник, бот открывает test Mini App по
  HTTPS, production secrets находятся вне Git.
- **Объём:** бот, URL, environment inventory, webhook secret/subscription,
  `open_app` smoke и runbook.
- **Зависимости:** нет; запускать сразу из-за внешнего ожидания.
- **Приёмка:** приложение реально открывается из MAX, webhook достигает backend,
  второй участник повторяет настройку по инструкции.
- **Проверка:** timestamped smoke в MAX и secret scan.
- **Оценка:** 4–8 ч без ожидания.

### MAX-002 — Подтвердить и реализовать привязку канала

- **Результат:** owner безопасно связывает компанию с каналом/чатом, куда бот
  действительно может публиковать.
- **Объём:** spike актуального Bot API, add-bot/command flow, webhook validation,
  pending confirmation, active/disabled binding и test post.
- **Не входит:** ввод произвольного `chat_id`, личное сообщение вместо канала.
- **Зависимости:** `MAX-001`, `IAM-001`, `COMP-001`.
- **Приёмка:** чужой пользователь не привязывает чат; invalid/replayed webhook
  отклоняется; successful test post активирует binding; отзыв прав видим.
- **Проверка:** contract/permission/dedupe tests и реальный канал MAX.
- **Оценка:** 14–22 ч.
- **Блокер:** если текущий MAX API не допускает нужный channel flow, Must-сценарий
  пересматривается явно.

### IAM-001 — Авторизация через MAX

- **Результат:** backend проверяет `initData` и создаёт защищённую сессию.
- **Объём:** `max_user_id`, миграция, HMAC/freshness/constant-time validation,
  `/api/auth/max/`, `/api/me/`, logout, CSRF и DEBUG-only login.
- **Приёмка:** valid launch создаёт/возвращает пользователя; tampered, expired,
  malformed и duplicate hash отклоняются; bot token отсутствует во frontend.
- **Проверка:** unit/request tests по официальному алгоритму + вход в MAX.
- **Зависимости:** real smoke ждёт `MAX-001`, unit work не ждёт.
- **Оценка:** 12–18 ч.

### COMP-001 — Компания и объектные права

- **Результат:** мониторинг принадлежит конкретной компании, owner управляет им.
- **Объём:** Company/Membership, миграции, API, owner/member permissions,
  минимальный экран названия компании.
- **Приёмка:** уникальное membership; данные другой компании не раскрываются;
  первый пользователь становится owner предсказуемо.
- **Проверка:** model/API permission tests и smoke двух identity.
- **Зависимости:** `IAM-001`.
- **Оценка:** 10–16 ч.

### TRUD-001 — Зафиксировать live-контракт «Работы России»

- **Результат:** доказан запрос по должности/региону и описана пригодность
  salary/region/employer полей для benchmark.
- **Объём:** official docs/terms/changelog, live probes для 3–4 линейных ролей в
  2 регионах, pagination/limits/schema/evidence card, правила атрибуции.
- **Приёмка:** сохранены обезличенные schema examples, известны timeout/limits,
  exclusion reasons и минимальный размер выборки; секреты не нужны/не сохранены.
- **Проверка:** воспроизводимый curl/script и review evidence.
- **Зависимости:** нет.
- **Оценка:** 6–10 ч.

### TRUD-002 — Реализовать отказоустойчивый API adapter

- **Результат:** backend получает и нормализует релевантные вакансии, не
  протаскивая source schema в домен.
- **Объём:** query builder, pagination cap, connect/read timeout, User-Agent,
  schema validation, normalized DTO, safe errors и recorded test fixtures.
- **Приёмка:** один live запрос проходит; timeout/invalid JSON/schema drift/5xx
  дают контролируемую ошибку; raw contacts не хранятся.
- **Проверка:** adapter contract/error/pagination tests + live smoke.
- **Зависимости:** `TRUD-001`.
- **Оценка:** 14–22 ч.

### VAC-001 — Ввод и сохранение одной вакансии

- **Результат:** owner задаёт title, регион и месячную зарплату в RUB; для
  компании действует один мониторинг.
- **Объём:** VacancyMonitor, constraints/migration, region choice, CRUD API и
  доступная mobile-first форма.
- **Приёмка:** невалидная зарплата/регион отклоняются; чужой объект недоступен;
  повторное сохранение не создаёт второй active monitor.
- **Проверка:** model/request/form tests и 320/390px smoke.
- **Зависимости:** `COMP-001`.
- **Оценка:** 12–18 ч.

### BOT-001 — Короткий диалог ввода вакансии

- **Результат:** бот последовательно спрашивает должность, регион и зарплату,
  создаёт draft одной вакансии и открывает её подтверждение в Mini App.
- **Объём:** conversation state/expiry, `/start`, три шага, валидация региона и
  денег, cancel/restart, webhook dedupe и open-app button.
- **Приёмка:** повтор события не двигает диалог дважды; неверный ответ можно
  исправить; чужой chat/user context не получает draft; незавершённая сессия
  истекает; итог совпадает с `VacancyMonitor`.
- **Проверка:** state-machine/request tests и реальный диалог с ботом MAX.
- **Зависимости:** `IAM-001`, `COMP-001`, `VAC-001`, `MAX-001`.
- **Оценка:** 14–22 ч.

### MARKET-001 — Рассчитать benchmark и сохранить snapshot

- **Результат:** из нормализованной live-выборки получаются count, sample size,
  median, range, percentile, position и competitors.
- **Объём:** чистый calculation service, exclusion counts, insufficient-data
  rule, MarketSnapshot/SnapshotCompetitor и idempotent persistence.
- **Приёмка:** правила из архитектуры проверены на odd/even samples, duplicates,
  bounds, empty/partial salary, wrong currency/period; float не используется.
- **Проверка:** table-driven unit tests + request test на recorded/live boundary.
- **Зависимости:** `TRUD-002`, `VAC-001`.
- **Оценка:** 16–24 ч.

### DASH-001 — Дашборд позиции вакансии

- **Результат:** пользователь видит понятный и проверяемый market snapshot.
- **Объём:** summary cards, доступное salary distribution, marker предложения,
  competitors, source/freshness/query/sample/exclusions и все UI states.
- **Приёмка:** числа совпадают с API; график имеет текстовый эквивалент; stale,
  insufficient-data и source unavailable нельзя спутать с live success.
- **Проверка:** component tests, API contract test, mobile/desktop browser smoke.
- **Зависимости:** `MARKET-001`, `IAM-001`.
- **Оценка:** 16–24 ч.

### ALERT-001 — Повторный срез и один тип MAX-алерта

- **Результат:** активный мониторинг пересчитывается по фиксированному расписанию
  и при существенном изменении создаёт один пост в channel binding.
- **Объём:** scheduler management command, snapshot comparison, Alert outbox,
  dedupe key, sender, timeout, bounded retry/rate limit и deep-link.
- **Приёмка:** одинаковый snapshot не отправляет сообщение; повтор job/webhook не
  дублирует; permanent error отключает/помечает binding; payload не содержит ПДн.
- **Проверка:** comparison/retry/dedupe tests, mocked Bot API и реальный post.
- **Зависимости:** `MARKET-001`, `MAX-002`.
- **Оценка:** 18–28 ч.

### FE-001 — Оболочка Mini App и MAX Bridge

- **Результат:** связный mobile flow с session bootstrap, route guards,
  BackButton, safe areas и безопасным browser fallback.
- **Объём:** app shell, routes, accessible forms, loading/empty/offline/error,
  MAX adapter и явный dev banner.
- **Приёмка:** основной путь проходится клавиатурой; back/deep route стабильны;
  DEBUG fallback отсутствует в production build.
- **Проверка:** component/browser smoke, затем `MAX-QA-001`.
- **Зависимости:** `IAM-001`; развивается вертикально с VAC/DASH/MAX-002.
- **Оценка:** 12–18 ч.

### SEC-001 — Security и privacy gate

- **Результат:** MAX secrets, company data и channel binding защищены сервером.
- **Объём:** permission matrix, IDOR/CSRF/session tests, rate limits, safe
  logs/errors, secret scan, audit actions и production cookie/host settings.
- **Приёмка:** все object endpoints имеют negative tests; tokens/initData/chat ID
  отсутствуют в логах/URL; unsafe DEBUG paths закрыты при `DEBUG=false`.
- **Проверка:** automated negative suite + manual checklist.
- **Зависимости:** `IAM-001`, `COMP-001`, `MAX-002`, `ALERT-001`.
- **Оценка:** 12–20 ч.

### QA-001 — Автоматизированный E2E основного сценария

- **Результат:** deterministic flow проходит от dev identity и формы до snapshot
  и mocked channel alert.
- **Объём:** backend integration, frontend behavior и browser E2E; source/Bot API
  подменяются только на HTTP boundary.
- **Приёмка:** clean DB run проверяет права, расчёт, insufficient/error states и
  dedupe; тест падает при нарушении контракта.
- **Проверка:** два последовательных полных прогона.
- **Зависимости:** `IAM-001`–`ALERT-001`, `FE-001`.
- **Оценка:** 14–22 ч.

### OPS-001 — HTTPS deployment и scheduler

- **Результат:** production-like контур доступен MAX и регулярно выполняет
  мониторинг без ручного запуска.
- **Объём:** deploy config, `DEBUG=false`, secret store, migration step, SPA deep
  routes, health probe, scheduler, backup/rollback и env inventory.
- **Приёмка:** HTTPS/trusted certificate, health/deep route работают, job имеет
  single-run protection, secrets вне Git, clean launch документирован.
- **Проверка:** Compose checks + deployment smoke.
- **Зависимости:** `MAX-001`, `SEC-001`.
- **Оценка:** 10–16 ч.

### MAX-QA-001 — Сквозная приёмка в MAX

- **Результат:** Must flow доказан на одном mobile и web/desktop клиенте MAX.
- **Объём:** login, vacancy input, live source, dashboard, channel binding, test
  post, change alert, deep-link, BackButton, reconnect и expired initData.
- **Приёмка:** все шаги проходят на dated evidence matrix; блокирующие дефекты
  закрыты; fixture не используется как live source.
- **Проверка:** повтор по чек-листу со screenshot/video evidence.
- **Зависимости:** `OPS-001`, `QA-001`, `ALERT-001`.
- **Оценка:** 8–14 ч активной работы.

### DELIV-001 — Комплект сдачи и демонстрация

- **Результат:** жюри воспроизводит продукт и отличает live evidence от demo.
- **Объём:** README, OpenAPI, `DATA-API.yaml`, test identity/data, architecture,
  MAX setup, live/fallback demo, presentation PDF, pilot metrics, commit hash или
  archive checksum.
- **Приёмка:** новый участник запускает demo; первый технический слайд содержит
  доступ; secrets отсутствуют; каждая заявленная функция имеет evidence.
- **Проверка:** clean-room walkthrough и две timed rehearsals.
- **Зависимости:** `MAX-QA-001`, `DISC-001`, все P0 gates.
- **Оценка:** 12–18 ч.

## P1 — Should Have

### VAC-002 — Несколько вакансий компании

- снять ограничение одной active vacancy, добавить список/архив и object limits;
- зависит от `VAC-001`, `DASH-001`; 10–16 ч.

### HIST-001 — История рынка

- показать динамику медианы, sample size и позиции по сохранённым snapshots;
- не интерполировать пропуски и явно показывать даты; 12–20 ч.

### ALERT-002 — Настройки мониторинга

- периодичность и пороги в разрешённых пределах, preview следующего сообщения;
- зависит от baseline `ALERT-001`; 10–16 ч.

### TEAM-001 — Участники компании

- приглашение/отзыв member, общий read-only доступ к dashboards, owner-only
  изменения и channel binding; 14–22 ч.

### AN-001 — Метрики пилота

- события benchmark/alert/open/condition-adjusted без MAX ID и чувствительных
  payload; отчёт time-to-hire использует явно подтверждённые даты; 12–18 ч.

## P2 — Could Have

### SME-001 — Исследовать bulk-реестр МСП

- подтвердить лицензию, состав, обновление и ключ сопоставления; подготовить
  одноразовый integrity-checked import plan, но не production integration;
- зависит от pilot evidence, 8–16 ч.

### SME-002 — Обогатить профиль компании

- загрузить заранее проверенную bulk-версию, показать provenance/freshness и
  только подтверждённые поля; не менять core benchmark; 16–28 ч.

## Won't Have

Отдельные карточки не создаются для других job API, кандидатов, откликов,
ATS/pipeline, публикации вакансий, AI-рекомендаций и scraping. Возврат этих идей
в backlog требует нового продуктового решения, а не тихого расширения P0.

## Сводка

| Приоритет | Задач | Оценка |
|---|---:|---:|
| P0 | 18 | 214–336 ч |
| P1 | 5 | 58–92 ч |
| P2 | 2 | 24–44 ч |
| Всего | 25 | 296–472 ч |
