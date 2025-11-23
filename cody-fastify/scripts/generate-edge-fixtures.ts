import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type FixtureMetadata = Record<string, number | string>;

type FixtureDocument = {
  description: string;
  provider: string;
  model: string;
  generated_by: string;
  generated_at: string;
  scenario: string;
  chunks: string[];
  metadata?: FixtureMetadata;
  expected_response?: unknown;
  stream_config?: {
    event_delay_ms?: number;
  };
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = resolve(__dirname, "../tests/fixtures/openai");
const SCRIPT_NAME = "scripts/generate-edge-fixtures.ts";
const TRACE_ID = "00-feedfacefeedfacefeedfacefeedface-cafebabecafebabe-01";

const LARGE_ITEM_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const RAPID_ITEM_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const ORDER_ITEM_ID = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const INVALID_ITEM_ID = "dddddddd-dddd-4ddd-dddd-dddddddddddd";

const LARGE_CHUNK_COUNT = 512;
// Keep bytes per delta far enough under the Convex 1 MiB document cap once
// metadata + envelope overhead are included.
const LARGE_BYTES_PER_DELTA = 1800;
const RAPID_DELTA_COUNT = 1000;

await mkdir(OUTPUT_DIR, { recursive: true });

const writers = [
  createLargeResponseFixture(),
  createRapidStreamFixture(),
  createOutOfOrderFixture(),
  createInvalidSchemaFixture(),
].map(({ filename, document }) =>
  writeFixture(filename, document),
);

await Promise.all(writers);

console.log(
  "Generated edge case fixtures:",
  [
    "large-response.json",
    "rapid-stream.json",
    "out-of-order.json",
    "invalid-schema.json",
  ].join(", "),
);

function createLargeResponseFixture(): {
  filename: string;
  document: FixtureDocument;
} {
  const chunks: string[] = [];
  const deltaChunks: string[] = [];
  let timestamp = 1;

  chunks.push(
    serializeEvent("response_start", timestamp++, {
      response_id: "{{runId}}",
      turn_id: "{{turnId}}",
      thread_id: "{{threadId}}",
      model_id: "{{modelId}}",
      provider_id: "{{providerId}}",
      created_at: 1,
    }),
  );

  chunks.push(
    serializeEvent("item_start", timestamp++, {
      item_id: LARGE_ITEM_ID,
      item_type: "message",
    }),
  );

  for (let i = 0; i < LARGE_CHUNK_COUNT; i += 1) {
    const text = buildDeltaText(i, LARGE_BYTES_PER_DELTA);
    deltaChunks.push(text);
    chunks.push(
      serializeEvent("item_delta", timestamp++, {
        item_id: LARGE_ITEM_ID,
        delta_content: text,
      }),
    );
  }

  const finalContent = deltaChunks.join("");

  chunks.push(
    serializeEvent("item_done", timestamp++, {
      item_id: LARGE_ITEM_ID,
      final_item: {
        id: LARGE_ITEM_ID,
        type: "message",
        content: finalContent,
        origin: "agent",
      },
    }),
  );

  chunks.push(
    serializeEvent("response_done", timestamp++, {
      response_id: "{{runId}}",
      status: "complete",
      usage: {
        prompt_tokens: 128,
        completion_tokens: LARGE_CHUNK_COUNT * 32,
        total_tokens: 128 + LARGE_CHUNK_COUNT * 32,
      },
      finish_reason: null,
    }),
  );

  const document: FixtureDocument = {
    description: "TC-ER-07 large response fixture (~1MB content)",
    provider: "openai",
    model: "gpt-5-mini",
    generated_by: SCRIPT_NAME,
    generated_at: new Date().toISOString(),
    scenario: "TC-ER-07",
    chunks,
    metadata: {
      chunk_count: LARGE_CHUNK_COUNT,
      bytes_per_delta: LARGE_BYTES_PER_DELTA,
      final_content_length: finalContent.length,
    },
    expected_response: {
      id: "{{runId}}",
      turn_id: "{{turnId}}",
      thread_id: "{{threadId}}",
      model_id: "gpt-5-mini",
      provider_id: "openai",
      created_at: 1,
      updated_at: timestamp - 1,
      status: "complete",
      output_items: [
        {
          id: LARGE_ITEM_ID,
          type: "message",
          content: finalContent,
          origin: "agent",
        },
      ],
      usage: {
        prompt_tokens: 128,
        completion_tokens: LARGE_CHUNK_COUNT * 32,
        total_tokens: 128 + LARGE_CHUNK_COUNT * 32,
      },
      finish_reason: null,
      error: null,
    },
  };

  return {
    filename: "large-response.json",
    document,
  };
}

function createRapidStreamFixture(): {
  filename: string;
  document: FixtureDocument;
} {
  const chunks: string[] = [];
  let timestamp = 1;

  chunks.push(
    serializeEvent("response_start", timestamp++, {
      response_id: "{{runId}}",
      turn_id: "{{turnId}}",
      thread_id: "{{threadId}}",
      model_id: "{{modelId}}",
      provider_id: "{{providerId}}",
      created_at: 1,
    }),
  );

  chunks.push(
    serializeEvent("item_start", timestamp++, {
      item_id: RAPID_ITEM_ID,
      item_type: "message",
    }),
  );

  const deltas: string[] = [];
  for (let i = 0; i < RAPID_DELTA_COUNT; i += 1) {
    const char = String.fromCharCode(97 + (i % 26));
    deltas.push(char);
    chunks.push(
      serializeEvent("item_delta", timestamp++, {
        item_id: RAPID_ITEM_ID,
        delta_content: char,
      }),
    );
  }

  const finalContent = deltas.join("");

  chunks.push(
    serializeEvent("item_done", timestamp++, {
      item_id: RAPID_ITEM_ID,
      final_item: {
        id: RAPID_ITEM_ID,
        type: "message",
        content: finalContent,
        origin: "agent",
      },
    }),
  );

  chunks.push(
    serializeEvent("response_done", timestamp++, {
      response_id: "{{runId}}",
      status: "complete",
      usage: {
        prompt_tokens: 64,
        completion_tokens: RAPID_DELTA_COUNT,
        total_tokens: 64 + RAPID_DELTA_COUNT,
      },
      finish_reason: null,
    }),
  );

  const document: FixtureDocument = {
    description: "TC-ER-08 rapid 1000-delta stream",
    provider: "openai",
    model: "gpt-5-mini",
    generated_by: SCRIPT_NAME,
    generated_at: new Date().toISOString(),
    scenario: "TC-ER-08",
    chunks,
    metadata: {
      delta_count: RAPID_DELTA_COUNT,
      final_content_length: finalContent.length,
    },
    expected_response: {
      id: "{{runId}}",
      turn_id: "{{turnId}}",
      thread_id: "{{threadId}}",
      model_id: "gpt-5-mini",
      provider_id: "openai",
      created_at: 1,
      updated_at: timestamp - 1,
      status: "complete",
      output_items: [
        {
          id: RAPID_ITEM_ID,
          type: "message",
          content: finalContent,
          origin: "agent",
        },
      ],
      usage: {
        prompt_tokens: 64,
        completion_tokens: RAPID_DELTA_COUNT,
        total_tokens: 64 + RAPID_DELTA_COUNT,
      },
      finish_reason: null,
      error: null,
    },
    stream_config: {
      event_delay_ms: 0,
    },
  };

  return {
    filename: "rapid-stream.json",
    document,
  };
}

function createOutOfOrderFixture(): {
  filename: string;
  document: FixtureDocument;
} {
  const chunks: string[] = [];
  let timestamp = 1;

  chunks.push(
    serializeEvent("response_start", timestamp++, {
      response_id: "{{runId}}",
      turn_id: "{{turnId}}",
      thread_id: "{{threadId}}",
      model_id: "{{modelId}}",
      provider_id: "{{providerId}}",
      created_at: 1,
    }),
  );

  chunks.push(
    serializeEvent("item_delta", timestamp++, {
      item_id: ORDER_ITEM_ID,
      delta_content: "out-of-order delta before item_start",
    }),
  );

  chunks.push(
    serializeEvent("item_start", timestamp++, {
      item_id: ORDER_ITEM_ID,
      item_type: "message",
    }),
  );

  chunks.push(
    serializeEvent("item_done", timestamp++, {
      item_id: ORDER_ITEM_ID,
      final_item: {
        id: ORDER_ITEM_ID,
        type: "message",
        content: "This item should not succeed",
        origin: "agent",
      },
    }),
  );

  chunks.push(
    serializeEvent("response_done", timestamp++, {
      response_id: "{{runId}}",
      status: "complete",
      usage: {
        prompt_tokens: 32,
        completion_tokens: 12,
        total_tokens: 44,
      },
      finish_reason: null,
    }),
  );

  const document: FixtureDocument = {
    description: "TC-ER-09 out-of-order stream",
    provider: "openai",
    model: "gpt-5-mini",
    generated_by: SCRIPT_NAME,
    generated_at: new Date().toISOString(),
    scenario: "TC-ER-09",
    chunks,
    metadata: {
      out_of_order: 1,
    },
  };

  return {
    filename: "out-of-order.json",
    document,
  };
}

function createInvalidSchemaFixture(): {
  filename: string;
  document: FixtureDocument;
} {
  const chunks: string[] = [];
  let timestamp = 1;

  chunks.push(
    serializeEvent("response_start", timestamp++, {
      response_id: "{{runId}}",
      turn_id: "{{turnId}}",
      thread_id: "{{threadId}}",
      model_id: "{{modelId}}",
      provider_id: "{{providerId}}",
      created_at: 1,
    }),
  );

  chunks.push(
    serializeEventRaw("item_start", timestamp++, {
      type: "item_start",
      item_type: "message",
      note: "Missing item_id should trip schema validation",
    }),
  );

  chunks.push(
    serializeEvent("item_delta", timestamp++, {
      item_id: INVALID_ITEM_ID,
      delta_content: "This should never appear",
    }),
  );

  chunks.push(
    serializeEvent("item_done", timestamp++, {
      item_id: INVALID_ITEM_ID,
      final_item: {
        id: INVALID_ITEM_ID,
        type: "message",
        content: "Invalid schema turn",
        origin: "agent",
      },
    }),
  );

  chunks.push(
    serializeEvent("response_done", timestamp++, {
      response_id: "{{runId}}",
      status: "complete",
      usage: {
        prompt_tokens: 16,
        completion_tokens: 8,
        total_tokens: 24,
      },
      finish_reason: null,
    }),
  );

  const document: FixtureDocument = {
    description: "TC-ER-12 invalid schema (missing item_id)",
    provider: "openai",
    model: "gpt-5-mini",
    generated_by: SCRIPT_NAME,
    generated_at: new Date().toISOString(),
    scenario: "TC-ER-12",
    chunks,
    metadata: {
      missing_field: "item_id",
    },
  };

  return {
    filename: "invalid-schema.json",
    document,
  };
}

function serializeEvent(
  type: string,
  timestamp: number,
  payload: Record<string, unknown>,
): string {
  return serializeEventRaw(type, timestamp, { ...payload, type });
}

function serializeEventRaw(
  type: string,
  timestamp: number,
  payload: Record<string, unknown>,
): string {
  const envelope = {
    event_id: "{{randomUUID}}",
    timestamp,
    trace_context: { traceparent: TRACE_ID },
    run_id: "{{runId}}",
    type,
    payload,
  };
  return `event: ${type}\ndata: ${JSON.stringify(envelope)}\n\n`;
}

function buildDeltaText(index: number, targetBytes: number): string {
  const label = `Chunk ${index.toString().padStart(4, "0")}: `;
  const remaining = Math.max(targetBytes - label.length, 0);
  return label + "x".repeat(remaining);
}

async function writeFixture(
  filename: string,
  document: FixtureDocument,
): Promise<void> {
  const filePath = join(OUTPUT_DIR, filename);
  await writeFile(filePath, JSON.stringify(document, null, 2) + "\n", "utf-8");
}
