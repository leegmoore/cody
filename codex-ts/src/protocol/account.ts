/**
 * Account and user plan types for the Codex protocol.
 *
 * Ported from: codex-rs/protocol/src/account.rs
 */

/**
 * Subscription plan types available in Codex.
 *
 * Maps to account tier/subscription level.
 */
export enum PlanType {
  /** Free tier - default plan */
  Free = 'free',
  /** Plus subscription tier */
  Plus = 'plus',
  /** Pro subscription tier */
  Pro = 'pro',
  /** Team subscription tier */
  Team = 'team',
  /** Business subscription tier */
  Business = 'business',
  /** Enterprise subscription tier */
  Enterprise = 'enterprise',
  /** Education subscription tier */
  Edu = 'edu',
  /** Unknown or unrecognized plan type */
  Unknown = 'unknown',
}
