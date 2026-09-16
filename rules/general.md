# General Engineering Rules

Read this file for every code, configuration, or test change.

## KISS, DRY, and YAGNI

- **KISS:** choose the most direct readable solution that fully handles the
  required behavior and failure cases. Boring framework-native code is preferred
  to clever machinery.
- **DRY:** keep each business rule, contract, and source of truth in one place.
  Do not merge code merely because it looks similar; small duplication is better
  than an abstraction that joins unrelated concepts.
- **YAGNI:** add flexibility only for a current requirement. Do not create
  interfaces with one implementation, factories for one product, generic
  repositories over the ORM, unused configuration, or scaffolding for later.
- Reuse in this order: existing project code, standard library, framework or
  platform feature, installed dependency, then the smallest custom code.
- A new dependency needs a concrete benefit that cannot be achieved clearly with
  what is already installed. Prefer a small local implementation for a small
  stable problem.

## Functions and abstractions

- A function should name a meaningful operation, isolate a real responsibility,
  centralize a rule, or remove proven duplication.
- Do not create a one-line function that only forwards arguments, returns one
  property, renames a built-in operation, or hides an obvious expression.
- A one-line function is justified when a framework requires a callback, when it
  defines a domain rule or security boundary, or when the name materially
  clarifies repeated behavior.
- Do not compress meaningful logic into a one-liner. Prefer explicit branches and
  intermediate names when they reveal intent or make errors easier to handle.
- Extract an abstraction after its stable responsibility is visible. Do not
  predict a future family of implementations.
- Keep related sequential logic together. File, class, function, and component
  size are signals for review, not targets that justify arbitrary splitting.

## Readability and style

- Match the surrounding module and its configured formatter, linter, and type
  checker. Automated project configuration outranks personal preference.
- Use English names for identifiers. Choose domain names over technical filler
  such as `data`, `manager`, `helper`, `util`, or `process` when a precise term
  exists.
- Comments explain why, constraints, non-obvious tradeoffs, or external behavior.
  They do not narrate the next line. Remove or update stale comments with code.
- Avoid boolean parameters when the call site becomes ambiguous. Prefer a named
  option, enum, or separate operation when behaviors are genuinely different.
- Use early returns to reduce nesting when they make the main path clearer.
- Delete dead code instead of commenting it out. Version control is the archive.
- Keep diffs focused. Do not reformat or refactor unrelated code while completing
  a feature or fix.

## Boundaries, errors, and security

- Validate untrusted input at the system boundary and convert it to a typed,
  domain-meaningful form before using it.
- Enforce authentication and authorization on the server next to the protected
  operation. Client-side visibility is not authorization.
- Return stable, actionable errors to clients. Keep stack traces, SQL, connection
  details, credentials, and internal exception messages out of responses.
- Catch the narrowest exception that can be handled. Preserve the original cause
  when translating errors, and do not silently discard failures.
- Keep secrets out of source, tests, fixtures, logs, and generated output. Add new
  environment variables to `.env.example` using safe local values or placeholders.
- Preserve public API, stored data, and environment-variable compatibility unless
  the request explicitly changes the contract.

## Contracts and data

- Define the request, response, status codes, permissions, side effects, and error
  shape before implementing an API change. Update all consumers in the same slice.
- Use explicit time zones and ISO 8601 at API boundaries. Do not use binary
  floating point for money.
- Put invariants in the strongest appropriate layer: database constraints for
  stored-data integrity, server validation for domain rules, and UI validation
  for immediate feedback.
- New behavior needs the smallest test that would fail without it. A bug fix
  should first gain a regression test when the failure is reproducible.
