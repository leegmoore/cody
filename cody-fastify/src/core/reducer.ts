import { cloneDeep } from "../util/clone.js";
import {
  OutputItem,
  Response,
  ResponseSchema,
  StreamEvent,
} from "./schema.js";

type MutableResponse = Omit<Response, "output_items"> & {
  output_items: OutputItem[];
};

type ItemBuffer = {
  id: string;
  type: OutputItem["type"];
  chunks: string[];
  name?: string;
  call_id?: string;
};

export class ResponseReducer {
  private current: MutableResponse | undefined;
  private readonly itemBuffers = new Map<string, ItemBuffer>();

  apply(event: StreamEvent): Response | undefined {
    switch (event.payload.type) {
      case "response_start":
        this.current = {
          id: event.payload.response_id,
          turn_id: event.payload.turn_id,
          thread_id: event.payload.thread_id,
          agent_id: event.payload.agent_id,
          model_id: event.payload.model_id,
          provider_id: event.payload.provider_id,
          created_at: event.payload.created_at,
          updated_at: event.timestamp,
          status: "in_progress",
          output_items: [],
          usage: undefined,
          finish_reason: null,
          error: undefined,
        };
        this.itemBuffers.clear();
        break;

      case "item_start":
        this.ensureResponse();
        this.itemBuffers.set(event.payload.item_id, {
          id: event.payload.item_id,
          type: event.payload.item_type,
          chunks: event.payload.initial_content ? [event.payload.initial_content] : [],
          name: event.payload.name,
          call_id: event.payload.arguments, // may be absent; actual call_id will be set on done
        });
        break;

      case "item_delta": {
        this.ensureResponse();
        const buf = this.itemBuffers.get(event.payload.item_id);
        if (buf) buf.chunks.push(event.payload.delta_content);
        break;
      }

      case "item_done": {
        const current = this.ensureResponse();
        const final = event.payload.final_item;
        current.output_items.push(final);
        this.itemBuffers.delete(event.payload.item_id);
        break;
      }

      case "item_error": {
        const current = this.ensureResponse();
        current.output_items.push({
          id: event.payload.item_id,
          type: "error",
          code: event.payload.error.code,
          message: event.payload.error.message,
          details: event.payload.error.details,
          origin: "system",
        });
        this.itemBuffers.delete(event.payload.item_id);
        break;
      }

      case "usage_update":
        this.ensureResponse().usage = event.payload.usage;
        break;

      case "response_done":
        this.ensureResponse().status = event.payload.status;
        this.current.finish_reason = event.payload.finish_reason;
        this.current.updated_at = event.timestamp;
        break;

      case "response_error":
        this.ensureResponse().status = "error";
        this.current.error = event.payload.error;
        this.current.updated_at = event.timestamp;
        break;

      case "heartbeat":
      case "item_cancelled":
      case "script_execution_start":
      case "script_execution_done":
      case "script_execution_error":
      case "turn_aborted_by_user":
        // Phase 1 reducer ignores these; they can be added later.
        break;
    }

    return this.snapshot();
  }

  snapshot(): Response | undefined {
    if (!this.current) return undefined;
    // Validate to ensure schema compliance.
    return ResponseSchema.parse(cloneDeep(this.current));
  }

  private ensureResponse(): MutableResponse {
    if (!this.current) {
      throw new Error("Reducer received event before response_start");
    }
    return this.current;
  }
}
