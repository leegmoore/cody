import { initialize } from "@traceloop/node-server-sdk";

type InitOptions = {
  serviceName?: string;
};

/**
 * Initialize OpenLLMetry (Traceloop) to send traces to Langfuse.
 * - Requires LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY.
 * - Optional LANGFUSE_BASE_URL (defaults to https://cloud.langfuse.com).
 */
export function initObservability(options?: InitOptions): void {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;

  if (!publicKey || !secretKey) {
    // Keys missing; skip initialization quietly to avoid crashing scripts.
    return;
  }

  const baseUrl =
    process.env.LANGFUSE_BASE_URL?.replace(/\/+$/, "") ??
    "https://cloud.langfuse.com";

  const traceUrl = `${baseUrl}/api/public/otel/v1/traces`;
  const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString("base64")}`;

  process.env.TRACELOOP_BASE_URL ??= traceUrl;
  process.env.TRACELOOP_HEADERS ??= `Authorization=${authHeader}`;

  initialize({
    appName: options?.serviceName ?? "cody-core",
    disableBatch: true,
  });
}
