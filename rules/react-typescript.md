# React and TypeScript Rules

Read this file for React, TypeScript, JavaScript, CSS, or frontend work.

## Style sources

Follow, in order:

1. `frontend/eslint.config.js`, the TypeScript configs, and surrounding code.
2. The official [Rules of React](https://react.dev/reference/rules).
3. The [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro).

Use the configured strict TypeScript mode. Components and their files use
`PascalCase`; functions, hooks, variables, and non-component files use
`camelCase`; custom hooks start with `use`. Keep imports grouped and remove unused
symbols. Do not suppress ESLint or TypeScript errors without a local explanation.

## TypeScript

- Prefer inference for local values and explicit types at component props, API
  boundaries, exported functions, and reusable hooks.
- Do not use `any`. Use `unknown` at an untyped boundary and narrow it before use.
- Avoid type assertions. Validate external data or use a type guard; assert only
  when runtime facts are already guaranteed and state that reason.
- Model finite states with literal unions or discriminated unions rather than
  multiple booleans that can contradict each other.
- Use optional values only when absence is valid. Handle `null` and `undefined`
  explicitly instead of hiding them with non-null assertions.
- Prefer immutable transformations and `const`. Do not mutate props, state, query
  data, or values already passed to JSX.

## Components and hooks

- Keep render pure and deterministic. Side effects belong in event handlers or an
  effect that synchronizes with an external system.
- Call hooks only at the top level of React components or custom hooks. Keep hook
  dependencies complete instead of disabling the lint rule.
- Keep state local until multiple distant consumers genuinely need ownership.
  Derive values during render rather than syncing derived state with an effect.
- Do not extract a component or one-line wrapper merely to return one child or
  rename a native element. Extract for meaningful reuse, independent behavior,
  accessibility, testability, or a clear domain concept.
- Prefer composition and standard elements over prop-heavy universal components.
  Avoid premature memoization; use it only for measured work or stable identity
  required by an API.

## Server state and API calls

- Use TanStack Query for server state. Query keys are stable and include every
  input that changes the response.
- Keep transport details in a small request function. Check `response.ok`, return
  typed data, and translate expected errors into user-actionable messages.
- Mutations must invalidate or update all affected queries. Prevent duplicate
  submissions when the operation is not safely repeatable.
- A data-driven component handles loading, error, empty, and success states. Keep
  previous data only when that is intentional and visible to the user.
- Do not copy query data into component state unless the user is editing an
  independent draft.

## Markup, accessibility, and CSS

- Use semantic HTML first. Buttons perform actions; links navigate. Every form
  control has a programmatically associated label.
- Preserve keyboard operation, visible focus, logical heading order, useful alt
  text, and sufficient contrast. Use ARIA only when native semantics are missing.
- Announce asynchronous status changes when necessary without moving focus
  unexpectedly.
- Reuse the existing CSS conventions and design tokens. Verify narrow mobile
  widths as well as desktop layout.
- Do not add a UI library for one component or use JavaScript for behavior that
  HTML and CSS already provide reliably.

## Tests

- Test behavior visible to the user: rendered content, accessible roles, input,
  navigation, network outcomes, and error recovery.
- Prefer role- and label-based queries over classes, DOM structure, or test IDs.
- Mock the HTTP boundary, not React or TanStack Query internals.
