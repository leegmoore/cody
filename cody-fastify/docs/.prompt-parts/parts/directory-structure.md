# Directory Structure

```
cody-fastify/
├── src/
│   ├── core/
│   │   ├── schema.ts        # Canonical Zod schemas (OutputItem, StreamEvent, Response)
│   │   ├── reducer.ts       # Stream event reduction to state
│   │   └── hydrator.ts      # Dehydrated → Hydrated reconstruction
│   │
│   ├── adapters/
│   │   ├── openai.ts        # OpenAI Responses API adapter
│   │   ├── anthropic.ts     # Anthropic Messages API adapter
│   │   └── types.ts         # Adapter interfaces
│   │
│   ├── workers/
│   │   ├── persistence.ts   # Redis → Convex worker
│   │   └── stream-relay.ts  # Redis → Client streaming worker
│   │
│   ├── routes/
│   │   ├── turn.ts          # POST /turn - submit prompt
│   │   ├── stream.ts        # GET /stream/:key - SSE endpoint
│   │   ├── runs.ts          # GET /runs - list runs
│   │   └── threads.ts       # Thread management
│   │
│   └── index.ts             # Fastify server setup
│
├── public/
│   ├── index.html           # Main UI
│   ├── app.js               # Vanilla JS client
│   └── styles.css
│
├── convex/
│   └── [Convex schema and functions]
│
├── tests/
│   ├── harness/             # Test infrastructure
│   └── [test files]
│
└── docs/
    ├── codex-core-2.0-tech-design.md  # Architecture spec
    └── .prompt-parts/                  # This directory
```
