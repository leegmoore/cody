# Cody Fastify

Simple Fastify server with a `/health` endpoint plus Playwright e2e smoke tests.

## Setup

```bash
bun install
```

## Development

```bash
bun run dev
```

## Quality Gates

```bash
bun run format
bun run lint
bun run build
bun run test:e2e
```

Start the server manually with `bun run start` and visit `http://127.0.0.1:4010/health` to confirm the JSON response.
