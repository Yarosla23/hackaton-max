# Testing and Delivery Rules

Read this file when behavior, tests, dependencies, migrations, Compose, or
delivery configuration changes.

## Verification strategy

- Start with the narrowest check that can disprove the change, then run every
  configured check for each affected layer.
- Tests verify observable behavior and important invariants, not line coverage or
  private implementation details. Keep fixtures small and deterministic.
- A regression test should fail for the original bug and pass for the fix.
- Cover the successful path plus meaningful validation, permission, empty-state,
  and failure paths introduced or changed by the work.
- Never weaken, skip, or delete a failing test merely to make the suite green.
  Update it only when the intended contract changed.
- Review generated migrations, lockfiles, and snapshots as code. Commit them only
  when the requested change requires them.

## Project checks

Use the containerized commands documented in `README.md`; project dependencies
may not exist on the host. For an affected layer, run at least:

- Backend: the targeted Vitest test, the complete `npm test --workspace backend`,
  `npm run typecheck --workspace backend`, `npm run lint --workspace backend`,
  and the bundled function build.
- Frontend: `npm run typecheck`, `npm run lint`, and `npm run build`.
- Compose: `docker compose config --quiet`, then exercise the changed behavior
  through its real HTTP entry point when the stack is available.

Document any check that could not run and the exact blocker. A build or unit test
does not prove browser behavior, production configuration, or database migration
performance that was not exercised.

## Dependencies and configuration

- Use existing libraries before adding another. A dependency change must update
  the appropriate input and lock files using the workflow in `README.md`.
- Pin versions consistently with the existing project. Inspect install scripts,
  license constraints, maintenance status, and transitive impact before adoption.
- Keep defaults safe for local development and make production-sensitive choices
  explicit. Never commit credentials or real secret values.
- Preserve standard project ports `8000` and `5173`. Temporary diagnostic
  overrides must stay outside committed configuration.
- Do not remove Compose volumes during normal verification; they contain local
  YDB data.

## Evidence-led debugging

- Reproduce the reported command, request, input, and path before changing code.
- Form one concrete hypothesis at a time and inspect the closest evidence: status,
  fresh logs, configuration, network, database state, then source code.
- For a frontend-proxied backend `500`, repeat the same HTTP request, inspect
  `docker compose ps -a` and fresh backend logs, then verify network membership,
  `YDB_CONNECTION_STRING`, and `VITE_PROXY_TARGET`. Change application code only when the
  evidence identifies application code as the cause.
- Fix the root cause at the shared boundary rather than adding guards to each
  symptom path. Add the smallest regression test that protects the fix.

## Completion gate

A task is complete only when:

- the requested user scenario works end to end within the verified scope;
- API contracts, migrations, consumers, and tests agree;
- relevant checks pass or their blockers are reported precisely;
- the final diff contains no unrelated edits, secrets, debug output, or temporary
  files; and
- the final response separates verified results from assumptions and untested
  behavior.
