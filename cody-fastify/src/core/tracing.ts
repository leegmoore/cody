import { randomBytes } from "node:crypto";
import type { TraceContext } from "./schema.js";

const HEX = "0123456789abcdef";

function randomHex(length: number): string {
  const bytes = randomBytes(Math.ceil(length / 2));
  let out = "";
  for (const byte of bytes) {
    out += HEX[(byte >> 4) & 0x0f] + HEX[byte & 0x0f];
  }
  return out.slice(0, length);
}

export function createTraceContext(): TraceContext {
  const traceId = randomHex(32);
  const spanId = randomHex(16);
  const traceparent = `00-${traceId}-${spanId}-01`;
  return { traceparent };
}

export function childTraceContext(parent: TraceContext): TraceContext {
  const [version, traceId] = parent.traceparent.split("-");
  const spanId = randomHex(16);
  const traceparent = `${version}-${traceId}-${spanId}-01`;
  return { traceparent, tracestate: parent.tracestate };
}
