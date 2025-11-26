# tdd-api Test Suite

## Purpose

TDD and integrity testing for full integration of the cody-fastify
local development environment.

## Principles

**NO MOCKS. NO SHIMS. NO SPECIAL CONFIG OVERRIDES. NO TEST INJECTIONS.**

These tests exercise the complete system with real infrastructure.
Changes to these principles require EXPLICIT user approval after discussion.

## Prerequisites

1. Assume Redis configured and running
2. Assume Convex configured and running (connectivity not validated)
3. Assume OpenAI API accessible
4. Assume Fastify Server running on port 4010

**The test suite validates Redis, OpenAI, and Fastify Server before running.**

## Running

```bash
# Start server first
bun run dev

# Run tests (separate terminal)
bun run test:tdd-api
```

## Environment Validation

Before tests execute, the suite validates:

| Service | Check               | Success                    |
| ------- | ------------------- | -------------------------- |
| Redis   | PING on port 6379   | PONG response              |
| Convex  | Query API call       | Connected and reachable    |
| OpenAI  | GET /v1/models      | Status 200                 |
| Fastify | GET /health on 4010 | Status 200                 |

If any check fails, all checks complete, status is reported, then tests exit.

## Tests

| Test File             | Description                                                      |
| --------------------- | ---------------------------------------------------------------- |
| simple-prompt.test.ts | Submit "hi cody", verify SSE stream, validate thread persistence |

## Adding Tests

1. Create `<name>.test.ts` in this directory
2. Import `validateEnvironment` and call in `beforeAll`
3. Test real endpoints with real infrastructure
4. Verify protocol/shape, not exact content
5. Update this README with test description
