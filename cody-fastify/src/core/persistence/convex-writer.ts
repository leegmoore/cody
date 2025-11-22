import { ConvexHttpClient } from "convex/browser";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { api } from "../../../convex/_generated/api.js";
import { cloneDeep } from "../../util/clone.js";
import type { OutputItem, Response } from "../schema.js";

const tracer = trace.getTracer("codex.projector");

type ConvexPersistArgs = {
  runId: string;
  turnId: string;
  threadId: string;
  agentId?: string;
  modelId: string;
  providerId: string;
  status: Response["status"];
  createdAt: number;
  updatedAt: number;
  outputItems: OutputItem[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

function transformOutputItem(item: OutputItem): OutputItem {
  return cloneDeep(item);
}

function transformResponse(response: Response): ConvexPersistArgs {
  return {
    runId: response.id,
    turnId: response.turn_id,
    threadId: response.thread_id,
    agentId: response.agent_id,
    modelId: response.model_id,
    providerId: response.provider_id,
    status: response.status,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    outputItems: response.output_items.map(transformOutputItem),
    usage: response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : undefined,
    finishReason: response.finish_reason ?? undefined,
    error: response.error
      ? {
          code: response.error.code,
          message: response.error.message,
          details: response.error.details,
        }
      : undefined,
  };
}

export class ConvexWriter {
  constructor(private readonly client: ConvexHttpClient) {}

  async persist(response: Response): Promise<void> {
    const payload = transformResponse(response);

    return tracer.startActiveSpan("convex.persist_response", async (span) => {
      span.setAttributes({
        "codex.run_id": response.id,
        "codex.thread_id": response.thread_id,
        "codex.turn_id": response.turn_id,
      });
      try {
        await this.client.mutation(api.messages.persist, payload);
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  async deleteByRunId(runId: string): Promise<void> {
    return tracer.startActiveSpan("convex.delete_response", async (span) => {
      span.setAttribute("codex.run_id", runId);
      try {
        await this.client.mutation(api.messages.deleteByRunId, { runId });
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }
}
