# AI Coding Agent Instructions

This file is the entry point for every coding agent working in this repository.
The user's request defines the outcome. Existing code and configuration define
how that outcome should fit the project.

## Project map

- `backend/`: Django and Django REST Framework applications.
- `frontend/`: React, TypeScript, Vite, and TanStack Query.
- `compose.yaml`: local PostgreSQL, backend, and frontend services.
- `README.md`: canonical development and verification commands.
- `rules/`: detailed instructions loaded only when their trigger applies.

## Rule routing

Read every applicable file before editing code:

- Any code, configuration, or test change: read
  [`rules/general.md`](rules/general.md).
- Python, Django, DRF, ORM, database, or migration work: also read
  [`rules/python-django.md`](rules/python-django.md).
- React, TypeScript, JavaScript, CSS, or frontend work: also read
  [`rules/react-typescript.md`](rules/react-typescript.md).
- Adding or changing behavior, tests, dependencies, migrations, Compose, or
  delivery configuration: also read
  [`rules/testing-and-delivery.md`](rules/testing-and-delivery.md).

When a change crosses backend and frontend, read all four files and preserve the
API contract across both sides.

## Required workflow

1. Read the request, the applicable rules, and every file on the affected path.
   Check `git status` first and preserve unrelated user changes.
2. Trace the complete behavior from its entry point to its observable result.
   Find and reuse the project's existing patterns before designing a new one.
3. Choose the smallest complete vertical slice. State an assumption when it is
   safe and reversible; ask only when the choice changes product behavior, data,
   security, or a public contract.
4. Implement in small cohesive changes. Run the narrowest relevant check after
   each change, then the full checks for every affected layer.
5. Review the final diff for correctness, accidental scope, secrets, generated
   artifacts, debug output, and missing tests or migrations.
6. Report the result, changed areas, checks actually run, and any unverified
   behavior. Never describe an unrun check as passing.

## Instruction precedence

Apply instructions in this order:

1. The current user request.
2. This file and the applicable files in `rules/`.
3. Tool configuration and established conventions in the affected module.
4. The external style guides linked from the rule files.

If two rules conflict, follow the higher-priority source and preserve local
consistency unless doing so would keep a confirmed bug or security issue.
