import { cloneDeep } from "../util/clone.js";
import { OutputItem, Response, ResponseSchema, StreamEvent } from "./schema.js";

type MutableResponse = Omit<Response, "output_items"> & {
  output_items: OutputItem[];
};

type ResponseStartPayload = Extract<
  StreamEvent["payload"],
  { type: "response_start" }
>;

type ItemBuffer = {
  id: string;
  type: OutputItem["type"];
  chunks: string[];
  meta: Record<string, unknown>;
};

export class ResponseReducer {
  private current: MutableResponse | undefined;
  private readonly itemBuffers = new Map<string, ItemBuffer>();
  private readonly processedEventIds = new Set<string>();
  private hasSequenceViolation = false;

  apply(event: StreamEvent): Response | undefined {
    const payloadType = event.payload.type;

    if (payloadType === "response_start") {
      if (this.processedEventIds.has(event.event_id)) {
        return this.snapshot();
      }
      this.bootstrapResponse(event, event.payload);
      this.processedEventIds.add(event.event_id);
      return this.snapshot();
    }

    if (this.processedEventIds.has(event.event_id)) {
      return this.snapshot();
    }
    this.processedEventIds.add(event.event_id);

    if (
      this.hasSequenceViolation &&
      (payloadType === "item_start" ||
        payloadType === "item_delta" ||
        payloadType === "item_done" ||
        payloadType === "item_error" ||
        payloadType === "item_cancelled")
    ) {
      return this.snapshot();
    }

    let mutated = false;
    switch (payloadType) {
      case "item_start": {
        const buffer: ItemBuffer = {
          id: event.payload.item_id,
          type: event.payload.item_type,
          chunks: [],
          meta: {},
        };
        if (event.payload.initial_content) {
          buffer.chunks.push(event.payload.initial_content);
        }
        if (event.payload.name) buffer.meta.name = event.payload.name;
        if (event.payload.arguments)
          buffer.meta.arguments = event.payload.arguments;
        if (event.payload.code) buffer.meta.code = event.payload.code;
        this.itemBuffers.set(event.payload.item_id, buffer);
        this.refreshBufferedItem(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_delta": {
        const buf = this.itemBuffers.get(event.payload.item_id);
        if (!buf) {
          this.markSequenceViolation(
            event,
            event.payload.item_id,
            "Received item_delta before item_start",
          );
          mutated = true;
          break;
        }
        buf.chunks.push(event.payload.delta_content);
        this.refreshBufferedItem(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_done": {
        if (!this.itemBuffers.has(event.payload.item_id)) {
          this.markSequenceViolation(
            event,
            event.payload.item_id,
            "Received item_done without item_start",
          );
          mutated = true;
          break;
        }
        const finalItem = cloneDeep(event.payload.final_item);
        this.upsertOutputItem(finalItem);
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_error": {
        this.removeOutputItem(event.payload.item_id);
        this.upsertOutputItem({
          id: event.payload.item_id,
          type: "error",
          code: event.payload.error.code,
          message: event.payload.error.message,
          details: event.payload.error.details,
          origin: "system",
        });
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "item_cancelled": {
        this.removeOutputItem(event.payload.item_id);
        this.upsertOutputItem({
          id: event.payload.item_id,
          type: "cancelled",
          reason: event.payload.reason,
          origin: "system",
        });
        this.itemBuffers.delete(event.payload.item_id);
        mutated = true;
        break;
      }

      case "usage_update": {
        const current = this.ensureResponse();
        current.usage = event.payload.usage;
        mutated = true;
        break;
      }

      case "response_done": {
        const current = this.ensureResponse();
        if (current.status !== "error" && current.status !== "aborted") {
          current.status = event.payload.status;
        }
        if (
          current.finish_reason === null ||
          current.finish_reason === undefined
        ) {
          current.finish_reason = event.payload.finish_reason;
        }
        if (event.payload.usage) {
          current.usage = event.payload.usage;
        }
        mutated = true;
        break;
      }

      case "response_error": {
        const current = this.ensureResponse();
        current.status = "error";
        current.error = event.payload.error;
        mutated = true;
        break;
      }

      case "turn_aborted_by_user": {
        const current = this.ensureResponse();
        current.status = "aborted";
        current.finish_reason = event.payload.reason;
        mutated = true;
        break;
      }

      case "heartbeat":
      case "script_execution_start":
      case "script_execution_done":
      case "script_execution_error": {
        // These events carry operational metadata that does not directly mutate
        // the persisted response snapshot. We accept them for trace continuity.
        break;
      }
    }

    if (mutated && this.current) {
      this.current.updated_at = Math.max(
        this.current.updated_at,
        event.timestamp,
      );
    }

    return this.snapshot();
  }

  snapshot(): Response | undefined {
    if (!this.current) return undefined;
    return ResponseSchema.parse(cloneDeep(this.current));
  }

  private bootstrapResponse(
    event: StreamEvent,
    payload: ResponseStartPayload,
  ): void {
    this.current = {
      id: payload.response_id,
      turn_id: payload.turn_id,
      thread_id: payload.thread_id,
      agent_id: payload.agent_id,
      model_id: payload.model_id,
      provider_id: payload.provider_id,
      created_at: payload.created_at,
      updated_at: event.timestamp,
      status: "in_progress",
      output_items: [],
      usage: undefined,
      finish_reason: null,
      error: null,
    };
    this.itemBuffers.clear();
    this.processedEventIds.clear();
    this.hasSequenceViolation = false;
  }

  private ensureResponse(): MutableResponse {
    if (!this.current) {
      throw new Error("Reducer received event before response_start");
    }
    return this.current;
  }

  private upsertOutputItem(item: OutputItem): void {
    const current = this.ensureResponse();
    const idx = current.output_items.findIndex(
      (existing) => existing.id === item.id,
    );
    if (idx >= 0) {
      current.output_items[idx] = item;
    } else {
      current.output_items.push(item);
    }
  }

  private removeOutputItem(itemId: string): void {
    if (!this.current) return;
    const idx = this.current.output_items.findIndex(
      (existing) => existing.id === itemId,
    );
    if (idx >= 0) {
      this.current.output_items.splice(idx, 1);
    }
  }

  private refreshBufferedItem(itemId: string): void {
    const buffer = this.itemBuffers.get(itemId);
    if (!buffer) return;

    if (buffer.type === "message") {
      const origin =
        (buffer.meta.origin as "user" | "agent" | "system" | undefined) ??
        "agent";
      this.upsertOutputItem({
        id: buffer.id,
        type: "message",
        content: buffer.chunks.join(""),
        origin,
        correlation_id: buffer.meta.correlation_id as string | undefined,
      });
      return;
    }

    if (buffer.type === "reasoning") {
      const origin =
        (buffer.meta.origin as "agent" | "system" | undefined) ?? "agent";
      this.upsertOutputItem({
        id: buffer.id,
        type: "reasoning",
        content: buffer.chunks.join(""),
        origin,
        correlation_id: buffer.meta.correlation_id as string | undefined,
      });
    }
  }

  private markSequenceViolation(
    event: StreamEvent,
    itemId: string,
    message: string,
  ): void {
    const current = this.ensureResponse();
    current.status = "error";
    current.error = {
      code: "STREAM_SEQUENCE_ERROR",
      message,
      details: {
        itemId,
        eventId: event.event_id,
        eventType: event.payload.type,
      },
    };
    current.finish_reason = "stream_error";
    this.removeOutputItem(itemId);
    this.itemBuffers.delete(itemId);
    this.hasSequenceViolation = true;
  }
}
