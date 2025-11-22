import EventSource from "eventsource";
import { ResponseReducer } from "../core/reducer.js";
import {
  StreamEventSchema,
  type Response,
  type StreamEvent,
} from "../core/schema.js";
import { HydrationError } from "./errors.js";

export interface StreamHydratorOptions {
  /**
   * Default timeout (ms) when waiting for SSE completion.
   * Individual calls can override this via hydrate options.
   */
  timeoutMs?: number;
  /**
   * Custom EventSource implementation (useful in tests/browsers).
   * Defaults to the `eventsource` Node polyfill.
   */
  eventSourceConstructor?: typeof EventSource;
  /**
   * Optional callback invoked for every successfully parsed event.
   */
  onEvent?: (event: StreamEvent) => void;
}

export interface HydrateFromSSEOptions {
  /**
   * Per-call timeout overriding the hydrator default.
   */
  timeoutMs?: number;
  /**
   * Last processed event ID used for resuming a stream.
   */
  lastEventId?: string;
  /**
   * Additional headers sent with the SSE request.
   */
  headers?: Record<string, string>;
}

export interface HydrateResult {
  response: Response;
  events: StreamEvent[];
}

/**
 * Client-side helper that applies streamed events to the canonical reducer.
 */
export class StreamHydrator {
  private readonly defaultTimeoutMs: number;
  private readonly EventSourceCtor: typeof EventSource;
  private readonly onEvent?: (event: StreamEvent) => void;

  private reducer: ResponseReducer;
  private readonly seenEvents: StreamEvent[] = [];

  constructor(options: StreamHydratorOptions = {}) {
    this.defaultTimeoutMs = options.timeoutMs ?? 30_000;
    this.EventSourceCtor = options.eventSourceConstructor ?? EventSource;
    this.onEvent = options.onEvent;
    this.reducer = new ResponseReducer();
  }

  /**
   * Reset internal reducer state so the hydrator can be reused.
   */
  reset(): void {
    this.reducer = new ResponseReducer();
    this.seenEvents.length = 0;
  }

  /**
   * Returns the latest snapshot of the response, if any events have been
   * processed. A defensive clone is returned by the reducer.
   */
  getPartial(): Response | undefined {
    return this.reducer.snapshot();
  }

  /**
   * Hydrate a response from an already collected set of events.
   */
  hydrateFromEvents(events: StreamEvent[]): HydrateResult {
    this.reset();
    let snapshot: Response | undefined;
    for (const event of events) {
      snapshot = this.applyEvent(event);
    }

    if (!snapshot) {
      throw new HydrationError(
        "SchemaViolation",
        "No response_start event received in event stream",
      );
    }

    return { response: snapshot, events: [...this.seenEvents] };
  }

  /**
   * Connect to an SSE endpoint, apply events as they stream in, and resolve
   * once the response is complete or errored.
   */
  hydrateFromSSE(
    url: string,
    options: HydrateFromSSEOptions = {},
  ): Promise<HydrateResult> {
    this.reset();

    if (!this.EventSourceCtor) {
      throw new HydrationError(
        "ConnectionError",
        "No EventSource implementation available",
      );
    }

    const headers: Record<string, string> = {
      ...(options.headers ?? {}),
    };
    if (options.lastEventId) {
      headers["Last-Event-ID"] = options.lastEventId;
    }

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    return new Promise<HydrateResult>((resolve, reject) => {
      let settled = false;
      let timeoutHandle: NodeJS.Timeout | undefined;
      let completed = false;
      let eventSource: EventSource | undefined;

      const settle = (err?: HydrationError, snapshot?: Response) => {
        if (settled) return;
        settled = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        eventSource?.close();
        if (err) {
          reject(err);
          return;
        }
        if (!snapshot) {
          reject(
            new HydrationError(
              "SchemaViolation",
              "SSE stream ended before producing a response",
            ),
          );
          return;
        }
        resolve({ response: snapshot, events: [...this.seenEvents] });
      };

      try {
        eventSource = new this.EventSourceCtor(
          url,
          Object.keys(headers).length ? { headers } : undefined,
        );
      } catch (error) {
        settle(
          new HydrationError("ConnectionError", "Failed to open SSE stream", {
            cause: error,
          }),
        );
        return;
      }

      if (timeoutMs > 0) {
        timeoutHandle = setTimeout(() => {
          settle(
            new HydrationError(
              "StreamTimeout",
              `Hydration timed out after ${timeoutMs}ms`,
            ),
          );
        }, timeoutMs);
        timeoutHandle.unref?.();
      }

      eventSource.onmessage = (message) => {
        try {
          const parsed = StreamEventSchema.parse(JSON.parse(message.data));
          const snapshot = this.applyEvent(parsed);
          if (
            parsed.payload.type === "response_done" ||
            parsed.payload.type === "response_error"
          ) {
            completed = true;
            settle(undefined, snapshot);
          }
        } catch (error) {
          settle(
            new HydrationError("MalformedEvent", "Failed to parse SSE event", {
              cause: error,
            }),
          );
        }
      };

      eventSource.onerror = (err) => {
        if (completed) {
          return;
        }
        settle(
          new HydrationError(
            "ConnectionError",
            "SSE connection error encountered",
            { cause: err },
          ),
          this.getPartial(),
        );
      };
    });
  }

  private applyEvent(event: StreamEvent): Response | undefined {
    this.seenEvents.push(event);
    this.onEvent?.(event);
    return this.reducer.apply(event);
  }
}


