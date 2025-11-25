# Application Overview

cody-fastify is a streaming-first LLM harness built on:
- **Fastify** - API server
- **Redis Streams** - Event transport with backpressure handling
- **Convex** - Persistence layer
- **OpenAI Responses API schema** - Canonical data model

## Core Design: One Shape, Multiple Hydration Levels

The same shape flows through the entire pipeline at different stages:
- **Streaming** - Events flowing in real-time
- **Dehydrated** - Complete but compact (for persistence)
- **Hydrated** - Reconstructed rich objects (for UI)

No format conversion between layers - just inflation/deflation of the same underlying structure.

## Data Flow

```
Client POST /turn
    ↓
Fastify → LLM API (streaming)
    ↓
Redis Streams (fanout)
    ├→ Persistence Worker → Convex
    └→ Streaming Endpoint → Client
```

## Key Directories

- `src/core/` - Schema, reducer, hydration
- `src/adapters/` - LLM provider adapters (OpenAI, Anthropic)
- `src/workers/` - Redis stream consumers
- `src/routes/` - Fastify API endpoints
- `public/` - Vanilla JS/HTML UI
