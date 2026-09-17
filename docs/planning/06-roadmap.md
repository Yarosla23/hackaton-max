# Порядок работ, зависимости и риски

## Принцип приоритизации

Самый короткий полезный вертикальный срез: реальный MAX user вводит одну
вакансию, backend делает живой запрос «Работы России», dashboard показывает
прозрачный benchmark, а бот публикует один апдейт в реальный канал. История,
несколько вакансий, участники и реестр МСП не предшествуют этому доказательству.

P0 оценивается в **214–336 человеко-часов** активной работы. Это не календарный
срок: выдача бота, platform review и внешние доступы могут идти дольше.

## Первые задачи

1. `MAX-001` — запустить бот/HTTPS и внешнее ожидание.
2. `TRUD-001` — проверить live-контракт и качество зарплатных данных.
3. `DISC-001` — подтвердить workflow HR и определения метрик.
4. `IAM-001` — закрыть server-side MAX auth.
5. `COMP-001` + `VAC-001` — привязать одну вакансию к компании.
6. `BOT-001` — собрать три поля в коротком диалоге MAX.
7. `TRUD-002` + `MARKET-001` — получить воспроизводимый live benchmark.
8. `DASH-001` — показать полезный результат.
9. `MAX-002` → `ALERT-001` — привязать канал и отправить change alert.
10. Security, E2E, deployment и реальная MAX QA.

## Этапы

### Этап 0 — внешние gates и контракты

**Задачи:** `MAX-001`, `TRUD-001`, `DISC-001`.

**Выход:** бот/HTTPS имеют ready или явный blocker; live source schema и правила
зарплатной выборки зафиксированы; метрики пилота операционализированы.

### Этап 1 — авторизованный разовый benchmark

**Задачи:** `IAM-001` → `COMP-001` → `VAC-001` → `BOT-001`; параллельно
`TRUD-002`; соединение в `MARKET-001` → `DASH-001`; `FE-001` развивается
вертикально.

**Выход:** реальный MAX user вводит одну вакансию и получает dashboard из живого
ответа. Это первая полезная вертикаль и первая точка demo.

### Этап 2 — командный контур MAX

**Задачи:** `MAX-002` → `ALERT-001`.

**Выход:** компания безопасно привязала канал; повторный snapshot создал ровно
один пост, а deep-link вернул пользователя в нужный dashboard.

### Этап 3 — стабилизация

**Задачи:** `SEC-001`, `QA-001`, `OPS-001`.

**Выход:** права, отрицательные пути, retries, source errors и scheduler
проверены; production-like HTTPS доступен с `DEBUG=false`.

### Этап 4 — MAX acceptance и сдача

**Задачи:** `MAX-QA-001` → `DELIV-001`.

**Выход:** mobile + web evidence, live source, channel post, OpenAPI/DATA-API,
presentation, demo fallback и зафиксированная версия без secrets.

## Критический путь

```text
MAX-001 → IAM-001 → COMP-001 → VAC-001 → BOT-001 ─┐
                                                   ├→ MARKET-001 → DASH-001
TRUD-001 → TRUD-002 ───────────────────────────────┘

IAM-001 + COMP-001 + MAX-001 → MAX-002
DASH-001 + MAX-002 → ALERT-001
ALERT-001 → SEC-001 → QA-001 → OPS-001 → MAX-QA-001 → DELIV-001
```

`DISC-001` не блокирует технический spike, но блокирует финальную формулировку
ценности, метрик и пилота. Если `TRUD-001` показывает недостаточную зарплатную
выборку для выбранных ролей, нельзя продолжать с фиктивной уверенностью: нужно
сузить роли/правило запроса или пересмотреть продуктовую гипотезу.

## Параллельные потоки

| Поток | Последовательность | Синхронизация |
|---|---|---|
| Product | `DISC-001` → pilot metrics → `DELIV-001` | определения метрик до аналитики и презентации |
| MAX platform | `MAX-001` → `IAM-001` → `MAX-002` → `ALERT-001` | channel capability должен быть доказан реальным API |
| Market data | `TRUD-001` → `TRUD-002` → `MARKET-001` | calculation contract фиксируется до dashboard |
| Product UI | `COMP-001` → `VAC-001` → `BOT-001` → `DASH-001`; сквозной `FE-001` | UI не придумывает новые вычисления |
| Quality/delivery | ранний `OPS-001`; затем `SEC-001` → `QA-001` → `MAX-QA-001` | freeze только после real MAX matrix |

## Stop/go gates

| Gate | Go | Stop/pivot |
|---|---|---|
| `TRUD-001` | Для пилотных ролей есть воспроизводимая выборка и сопоставимые salary fields | Выборка системно мала/несопоставима; нельзя обещать benchmark |
| `MAX-001` | Bot + HTTPS Mini App реально открываются | Нет platform access к сроку demo |
| `MAX-002` | Bot может быть безопасно привязан и писать в нужный channel context | API/права не поддерживают заявленный командный сценарий |
| `DISC-001` | HR понимает результат и может назвать решение после алерта | Пользователь не доверяет выборке или не влияет на условия |
| `MAX-QA-001` | Must flow проходит mobile + web | Browser-only demo не закрывает допуск |

## Главные риски

| Риск | Ранний сигнал | Реакция |
|---|---|---|
| Нерелевантные результаты текстового поиска | ручная выборка содержит другие роли | показать query, сузить правило, добавить измеряемый relevance sample |
| Мало вакансий с полной зарплатой | `salary_sample_size / total_found` низок | insufficient-data вместо рекомендации; сузить пилотные роли |
| Source schema/rate limit меняются | validation/429 растут | adapter boundary, timeout, bounded retry, schema alert; не scraping |
| MAX не даёт требуемый channel flow | нет документированного события/права | ранний `MAX-002`, явный product gate |
| Дубликаты постов | retry создаёт два сообщения | unique dedupe key + outbox + idempotent sender |
| Утечка chat/company данных | IDOR или sensitive log | object permissions, safe logging, `SEC-001` до pilot |
| Live demo зависит от сети | rehearsal нестабилен | отдельный явно маркированный fixture и backup video; не считать их live proof |
| Метрика time-to-hire не успевает созреть | вакансии не закрылись за пилот | отдельно ранние behavioral signals и censored vacancies |
| Scope возвращается к ATS | появляются candidate/application задачи | держать Won't; новое решение только через product review |

## Definition of Ready для P0

- указан observable result и владелец;
- public contract, права и source of truth определены;
- внешняя capability подтверждена spike либо отмечена как gate;
- acceptance отделяет mock/fixture от live проверки;
- нет незакрытого решения о ПДн, secret или object permission.

## Definition of Done для MVP

- вход выполнен через реальный MAX и проверен backend;
- одна вакансия связана с конкретной компанией;
- первый dashboard построен по живому запросу «Работы России» и показывает
  query, freshness, total, salary sample и исключения;
- расчёт median/range/percentile детерминирован и покрыт тестами;
- owner безопасно привязал реальный канал, тестовый пост и один change alert
  доставлены без дублей;
- основной путь пройден в mobile и web/desktop MAX;
- source/error/insufficient-data состояния различимы;
- backend/frontend checks, migrations, E2E, Compose и HTTPS smoke пройдены;
- OpenAPI, DATA-API, README, demo и presentation относятся к одной
  зафиксированной версии;
- fixture нигде не выдан за live data, secrets отсутствуют в Git;
- непроверенное влияние на time-to-hire сформулировано как гипотеза пилота.
