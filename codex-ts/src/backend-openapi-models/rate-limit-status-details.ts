import type { RateLimitWindowSnapshot } from "./rate-limit-window-snapshot.js";

/**
 * Rate limit status details
 * Generated from OpenAPI schema
 *
 * Note: Uses double-optional pattern from Rust (Option<Option<Box<T>>>)
 * to distinguish between "not present", "explicitly null", and "has value"
 */
export interface RateLimitStatusDetails {
  allowed: boolean;
  limit_reached: boolean;
  primary_window?: RateLimitWindowSnapshot | null;
  secondary_window?: RateLimitWindowSnapshot | null;
}
