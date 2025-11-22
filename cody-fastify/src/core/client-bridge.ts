import { StreamEventSchema, STREAM_EVENT_TYPES } from "./schema.js";
import type { StreamEvent, StreamEventType } from "./schema.js";

type MessageEventLike = {
  data: string;
  lastEventId?: string;
  type?: string;
};

export interface EventSourceLike {
  addEventListener(
    type: string,
    listener: (event: MessageEventLike) => void,
  ): void;
  removeEventListener(
    type: string,
    listener: (event: MessageEventLike) => void,
  ): void;
  close(): void;
  readyState?: number;
}

export interface EventSourceCtor {
  new (url: string, init?: EventSourceInitLike): EventSourceLike;
}

export interface EventSourceInitLike {
  withCredentials?: boolean;
  headers?: Record<string, string>;
  lastEventId?: string;
}

export interface RunStreamClientHandlers {
  onEvent?: (event: StreamEvent) => void;
  onDone?: (event: StreamEvent) => void;
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number) => void;
}

export interface RunStreamClientOptions {
  eventSourceCtor?: EventSourceCtor;
  reconnectDelayMs?: number;
  keepAliveTimeoutMs?: number;
  headers?: Record<string, string>;
  lastEventId?: string;
  maxReconnectAttempts?: number;
}

const DEFAULT_RECONNECT_DELAY_MS = 2000;
const DEFAULT_KEEPALIVE_TIMEOUT_MS = 45000;

const ALL_EVENT_NAMES: ReadonlyArray<StreamEventType | "message"> = [
  "message",
  ...STREAM_EVENT_TYPES,
] as const;

export class RunStreamClient {
  private readonly handlers: RunStreamClientHandlers;
  private readonly options: RunStreamClientOptions;
  private readonly eventSourceCtor: EventSourceCtor;
  private eventSource: EventSourceLike | undefined;
  private keepAliveTimer: NodeJS.Timeout | undefined;
  private reconnectTimer: NodeJS.Timeout | undefined;
  private lastEventAt = 0;
  private lastEventId: string | undefined;
  private reconnectAttempts = 0;
  private closed = false;

  private readonly messageListener = (evt: MessageEventLike) =>
    this.handleMessage(evt);
  private readonly errorListener = () => this.handleError();

  constructor(
    private readonly url: string,
    handlers: RunStreamClientHandlers,
    options: RunStreamClientOptions = {},
  ) {
    this.handlers = handlers;
    this.options = options;
    this.lastEventId = options.lastEventId;
    const ctor = options.eventSourceCtor ?? inferGlobalEventSource();
    if (!ctor) {
      throw new Error(
        "No EventSource implementation available. Provide eventSourceCtor.",
      );
    }
    this.eventSourceCtor = ctor;
  }

  start(): void {
    if (this.closed) {
      throw new Error("RunStreamClient is closed");
    }
    if (this.eventSource) {
      return;
    }
    this.open();
  }

  stop(): void {
    this.closed = true;
    this.clearTimers();
    this.disposeEventSource();
  }

  private open(): void {
    this.disposeEventSource();
    this.clearTimers();

    const init: EventSourceInitLike = {
      withCredentials: false,
      headers: { ...(this.options.headers ?? {}) },
    };
    if (this.lastEventId) {
      init.headers ??= {};
      init.headers["Last-Event-ID"] = this.lastEventId;
      init.lastEventId = this.lastEventId;
    }

    this.eventSource = new this.eventSourceCtor(this.url, init);
    this.lastEventAt = Date.now();
    this.reconnectAttempts = 0;

    for (const eventName of ALL_EVENT_NAMES) {
      this.eventSource.addEventListener(eventName, this.messageListener);
    }
    this.eventSource.addEventListener("error", this.errorListener);

    this.keepAliveTimer = setInterval(() => {
      const timeout =
        this.options.keepAliveTimeoutMs ?? DEFAULT_KEEPALIVE_TIMEOUT_MS;
      if (Date.now() - this.lastEventAt > timeout) {
        this.handlers.onError?.(
          new Error(
            `SSE connection stalled after ${Math.round(
              timeout / 1000,
            )} seconds`,
          ),
        );
        this.restart();
      }
    }, this.options.keepAliveTimeoutMs ?? DEFAULT_KEEPALIVE_TIMEOUT_MS);
  }

  private handleMessage(evt: MessageEventLike): void {
    if (this.closed) {
      return;
    }
    if (!evt || typeof evt.data !== "string" || evt.data.trim().length === 0) {
      return;
    }

    this.lastEventAt = Date.now();
    if (evt.lastEventId) {
      this.lastEventId = evt.lastEventId;
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(evt.data);
    } catch (error) {
      this.handlers.onError?.(
        new Error(
          `Failed to parse SSE payload as JSON: ${
            (error as Error).message ?? "unknown error"
          }`,
        ),
      );
      return;
    }

    const parsed = StreamEventSchema.safeParse(parsedJson);
    if (!parsed.success) {
      this.handlers.onError?.(
        new Error(`Invalid stream event payload: ${parsed.error.message}`),
      );
      return;
    }

    const event = parsed.data;
    this.handlers.onEvent?.(event);

    if (
      event.payload.type === "response_done" ||
      event.payload.type === "response_error" ||
      event.payload.type === "turn_aborted_by_user"
    ) {
      this.handlers.onDone?.(event);
      this.stop();
    }
  }

  private handleError(): void {
    if (this.closed) {
      return;
    }
    this.handlers.onError?.(new Error("SSE connection error"));
    this.restart();
  }

  private restart(): void {
    if (this.closed) {
      return;
    }
    this.disposeEventSource();
    this.clearTimers();
    const maxAttempts = this.options.maxReconnectAttempts ?? Infinity;
    if (this.reconnectAttempts >= maxAttempts) {
      this.handlers.onError?.(
        new Error("Maximum SSE reconnect attempts exceeded"),
      );
      this.stop();
      return;
    }
    this.reconnectAttempts += 1;
    this.handlers.onReconnect?.(this.reconnectAttempts);
    const delay = this.options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.closed) {
        this.open();
      }
    }, delay);
  }

  private disposeEventSource(): void {
    if (!this.eventSource) {
      return;
    }
    for (const eventName of ALL_EVENT_NAMES) {
      this.eventSource.removeEventListener(eventName, this.messageListener);
    }
    this.eventSource.removeEventListener("error", this.errorListener);
    try {
      this.eventSource.close();
    } catch {
      // ignore close errors
    }
    this.eventSource = undefined;
  }

  private clearTimers(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}

function inferGlobalEventSource(): EventSourceCtor | undefined {
  const globalAny = globalThis as {
    EventSource?: EventSourceCtor;
  };
  return globalAny.EventSource;
}
