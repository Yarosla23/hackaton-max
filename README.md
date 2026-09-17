# Hackathon MAX

Бот и мини-приложение MAX для сравнения линейной вакансии с живым рынком труда.
Пользователь задаёт должность, регион и зарплату; backend получает открытые
вакансии «Работы России», рассчитывает рыночную позицию предложения, а бот
публикует изменения в канал команды найма.

Сейчас репозиторий содержит техническую основу Django REST API, PostgreSQL и
React/Vite. Продуктовый сценарий запланирован в
[`docs/planning/`](docs/planning/README.md), но ещё не реализован. Конфигурация
Docker Compose предназначена только для локальной разработки.

## Запуск

На машине нужны только Docker и Docker Compose. Из корня проекта выполните:

```bash
docker compose up
```

При первом запуске Compose соберёт образы, дождётся PostgreSQL, применит
сохранённые миграции и запустит dev-серверы. Копировать `.env.example` не
обязательно: небезопасные локальные значения уже заданы по умолчанию.

Адреса:

- frontend: <http://localhost:5173>;
- backend: <http://localhost:8000>;
- Swagger UI: <http://localhost:8000/api/docs/>;
- OpenAPI schema: <http://localhost:8000/api/schema/>;
- Django Admin: <http://localhost:8000/admin/>.

## Переменные окружения

Чтобы изменить локальные значения, скопируйте `.env.example` в `.env` и
отредактируйте его:

- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — подключение к БД;
- `DJANGO_SECRET_KEY` — передаётся backend как `SECRET_KEY`;
- `DJANGO_DEBUG` — передаётся backend как `DEBUG`;
- `DJANGO_ALLOWED_HOSTS` — список хостов через запятую;
- `VITE_PROXY_TARGET` — адрес backend внутри Docker-сети.

Значения по умолчанию небезопасны и подходят только для локальной разработки.
Production-настройки, HTTPS и управление реальными секретами здесь не
реализованы.

## Команды разработки

Создать суперпользователя (автоматически он не создаётся):

```bash
docker compose exec backend python manage.py createsuperuser
```

После изменения Django-моделей создать миграции и сохранить их в Git:

```bash
docker compose exec backend python manage.py makemigrations
```

Применить миграции вручную без перезапуска (при обычном старте они применяются
автоматически):

```bash
docker compose exec backend python manage.py migrate
```

Запустить backend-тесты и Ruff:

```bash
docker compose exec backend pytest
docker compose exec backend ruff check .
```

Проверить frontend:

```bash
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run build
```

### Новые зависимости

Python-зависимость добавьте с точной версией в `backend/requirements.in`,
пересоберите полный lock-файл в чистом Python-контейнере и затем пересоберите
backend:

```bash
docker run --rm \
  -v "$PWD/backend/requirements.in:/tmp/requirements.in:ro" \
  python:3.13.7-slim-bookworm \
  sh -c 'pip install --quiet -r /tmp/requirements.in && pip freeze' \
  > backend/requirements.lock
docker compose build backend
docker compose up -d backend
```

Frontend-зависимость устанавливайте через одноразовый Compose-контейнер: он
обновит `package.json`, `package-lock.json` и отдельный volume `node_modules`.
После этого пересоберите образ:

```bash
docker compose run --rm frontend npm install <package>
docker compose build frontend
docker compose up -d frontend
```

## Остановка

Остановить контейнеры, сохранив базу данных:

```bash
docker compose down
```

Удалить контейнеры и volumes, включая всю локальную базу данных:

```bash
docker compose down --volumes
```

> Внимание: последняя команда необратимо удаляет данные PostgreSQL.
