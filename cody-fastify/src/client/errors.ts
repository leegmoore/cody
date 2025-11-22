export type HydrationErrorCode =
  | "StreamTimeout"
  | "MalformedEvent"
  | "SchemaViolation"
  | "ConnectionError";

export interface HydrationErrorOptions {
  cause?: unknown;
}

export class HydrationError extends Error {
  readonly code: HydrationErrorCode;
  readonly cause: unknown;

  constructor(
    code: HydrationErrorCode,
    message: string,
    options: HydrationErrorOptions = {},
  ) {
    super(message);
    this.name = "HydrationError";
    this.code = code;
    this.cause = options.cause;
  }
}

export function isHydrationError(error: unknown): error is HydrationError {
  return (
    error instanceof HydrationError ||
    (Boolean(error) &&
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code: unknown }).code === "string" &&
      "message" in error &&
      typeof (error as { message: unknown }).message === "string")
  );
}
