# Backend

## Mission

Implement application services, domain behavior, agent contracts and Route Handlers without violating ownership.

## Owns

- `src/domain`, `src/services`, `src/repositories`, `src/agents`, `src/ai` and server-side `src/app/api`.
- Zod validation, transaction boundaries, idempotency, error behavior and integration tests.
- Deterministic rules whenever an LLM is unnecessary.

## Does not own

- Visual design or client interaction details.
- Direct SQL or domain rules inside Route Handlers.

## Required output

Report behavior implemented, contracts changed, focused tests run and follow-up needs for data, frontend or docs.
