import type { StreamEvent } from "../../../src/core/schema";
import type { ResponseReducer } from "../../../src/core/reducer";

/**
 * Thread response body from GET /api/v2/threads/:threadId
 */
export type ThreadBody = {
  thread: {
    threadId: string;
    modelProviderId: string | null;
    model: string | null;
    createdAt: string;
    updatedAt: string;
  };
  runs: Array<RunData>;
};

/**
 * Run data structure as returned from the API
 */
export type RunData = {
  id: string;
  turn_id: string;
  thread_id: string;
  model_id: string;
  provider_id: string;
  status: "queued" | "in_progress" | "complete" | "error" | "aborted";
  created_at: number;
  updated_at: number;
  finish_reason: string | null;
  error: unknown;
  output_items: Array<OutputItemData>;
  usage: UsageData;
};

/**
 * Output item data from the API
 */
export type OutputItemData = {
  id: string;
  type:
    | "message"
    | "reasoning"
    | "function_call"
    | "function_call_output"
    | "error"
    | "cancelled"
    | "script_execution"
    | "script_execution_output";
  content?: string;
  origin?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  output?: string;
  success?: boolean;
};

/**
 * Usage data structure
 */
export type UsageData = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

/**
 * Options for submitting a prompt
 */
export type SubmitOptions = {
  prompt: string;
  model?: string;
  providerId?: string;
  threadId?: string;
  reasoningEffort?: "low" | "medium" | "high"; // OpenAI
  thinkingBudget?: number; // Anthropic
};

/**
 * Result from streaming and collecting events
 */
export type StreamResult = {
  events: StreamEvent[];
  threadId: string;
  hydratedResponse: NonNullable<ReturnType<ResponseReducer["snapshot"]>>;
  runId: string;
};

/**
 * Provider expectations for assertions
 */
export type ProviderExpectations = {
  providerId?: string;
  model: string;
  expectedProviderId?: string;
  expectedModelId?: string;
};
