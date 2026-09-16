# Python, Django, and DRF Rules

Read this file for Python, Django, DRF, ORM, database, or migration work.

## Style sources

Follow, in order:

1. `backend/pyproject.toml` and the surrounding module.
2. [PEP 8](https://peps.python.org/pep-0008/).
3. Django's official coding style:
   <https://docs.djangoproject.com/en/5.2/internals/contributing/writing-code/coding-style/>.

Use four-space indentation and the configured 88-character line length. Let Ruff
own import ordering and enabled lint rules. Use `snake_case` for functions,
methods, variables, modules, and model fields; `PascalCase` for classes; and
`UPPER_SNAKE_CASE` for constants. Add targeted `noqa` comments only with a reason.

Prefer type hints on public functions, service boundaries, and non-obvious return
types. Do not add annotations that merely repeat an obvious local assignment.
Docstrings are for public contracts or behavior that names and types cannot make
clear; comments and docstrings must remain accurate.

## Django structure

- Put code in the appropriate application under `backend/apps/`. Create a new app
  only for a distinct domain with its own models or workflows.
- Views handle HTTP concerns: authentication, parsing, calling domain logic, and
  forming the response. When behavior becomes non-trivial, move it to a plain,
  explicitly named function or module rather than hiding it in a view, serializer,
  model `save()`, or signal.
- Serializers own transport validation and representation. Use explicit domain
  operations for workflows spanning multiple models or external side effects.
- Signals are for framework integration where the caller cannot invoke the action
  explicitly. Avoid signals for core business workflows.
- Use `settings.AUTH_USER_MODEL` in model fields and `get_user_model()` at runtime.
- Use `transaction.atomic()` for a business operation that must commit as one unit.
  Keep external network calls outside long database transactions.
- Place API routes under `/api/`. Keep status codes and error shapes consistent,
  and never expose internal exception or database details.

## ORM and query discipline

- Treat database queries inside loops, serializer methods, properties, and template
  access as suspected N+1 behavior until proven otherwise.
- Load known single-valued relations with `select_related()` and collections with
  `prefetch_related()` or `Prefetch`. Fetch only relations the response uses.
- Push filtering, aggregation, existence checks, and bulk changes into the
  database with QuerySet operations where this remains readable and correct.
- Use `exists()`, `count()`, `values()`, or `values_list()` when model instances are
  unnecessary. Do not add speculative indexes or query tricks without evidence.
- Protect list endpoints and other query-sensitive paths with a query-count test
  when a future N+1 regression is plausible.
- Use row locks, database constraints, or idempotency keys when concurrent writes
  could violate an invariant. A read followed by a write is not concurrency-safe
  by itself.

See Django's official
[database optimization guide](https://docs.djangoproject.com/en/5.2/topics/db/optimization/)
for QuerySet evaluation and relation loading.

## Models and migrations

- Keep model members in a predictable order: fields, managers, `Meta`, string and
  standard methods, then domain methods. Give constraints and indexes stable names.
- Every model change includes a committed migration. Run
  `makemigrations --check --dry-run` to detect migration drift.
- Use `apps.get_model()` inside `RunPython`; never import the live model into a
  migration. Migration code must work years later against its historical state.
- Data migrations must not perform one query per row or per relation. Prefer a
  set-based `update()`, database expressions, `bulk_create()`, or `bulk_update()`.
  When per-row Python logic is unavoidable, prefetch required relations, iterate
  in bounded batches, and bulk-write each batch.
- Keep memory bounded for large tables with `iterator(chunk_size=...)` or explicit
  primary-key batches. Do not call `save()` in an unbounded migration loop.
- Separate schema changes from large backfills when one migration would lock a
  table or transaction for too long. Use an expand/backfill/contract sequence for
  new required fields on existing rows.
- Make data migrations reversible when a reliable inverse exists. Use an explicit
  `RunPython.noop` only when retaining migrated data on rollback is intentional.
- Add cross-app migration dependencies for every historical model used. Preserve
  database aliases through the provided `schema_editor` when relevant.
- Test risky data migrations from the previous schema state with representative
  row counts and verify both data correctness and query growth.

Follow Django's official guidance on
[migrations and historical models](https://docs.djangoproject.com/en/5.2/topics/migrations/).

## Tests

- Use pytest's plain `assert` style and descriptive `test_<behavior>` names.
- Mark tests that access the database with `pytest.mark.django_db`.
- Test successful behavior, meaningful validation failures, authorization, side
  effects, and transaction rollback where those paths exist.
- Assert the public result rather than private calls. Mock network and other
  process boundaries, not the ORM behavior the test is meant to verify.
