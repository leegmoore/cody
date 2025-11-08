import { EventEmitter } from "events";

/**
 * Opaque subscription token returned by subscribe().
 */
export class Token {
  constructor(public readonly id: number) {}
}

/**
 * Error thrown when readiness operations fail.
 */
export class ReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadinessError";
  }

  static flagAlreadyReady(): ReadinessError {
    return new ReadinessError("Flag is already ready. Impossible to subscribe");
  }

  static tokenLockFailed(): ReadinessError {
    return new ReadinessError("Failed to acquire readiness token lock");
  }
}

/**
 * Readiness flag with token-based authorization and async waiting.
 *
 * This provides a synchronization primitive where:
 * - Multiple parties can subscribe to get tokens
 * - Any token holder can mark the flag ready
 * - Once ready, the flag stays ready forever
 * - If no subscribers exist, the flag auto-marks as ready
 *
 * @example
 * ```typescript
 * const flag = new ReadinessFlag();
 * const token = await flag.subscribe();
 *
 * // In another context...
 * await flag.waitReady();
 *
 * // Mark ready when condition is met
 * await flag.markReady(token);
 * ```
 */
export class ReadinessFlag {
  private ready: boolean = false;
  private nextId: number = 1;
  private tokens: Set<number> = new Set();
  private emitter: EventEmitter = new EventEmitter();
  private lockHeld: boolean = false;

  /**
   * Returns true if the flag is currently marked ready.
   * Once true, it never becomes false again.
   */
  isReady(): boolean {
    if (this.ready) {
      return true;
    }

    // If no tokens are subscribed, auto-mark as ready
    if (this.tokens.size === 0 && !this.lockHeld) {
      this.ready = true;
      this.emitter.emit("ready");
      return true;
    }

    return this.ready;
  }

  /**
   * Subscribe to readiness and receive an authorization token.
   *
   * @throws {ReadinessError} If the flag is already ready
   * @returns Promise that resolves with a token
   */
  async subscribe(): Promise<Token> {
    if (this.ready) {
      throw ReadinessError.flagAlreadyReady();
    }

    this.lockHeld = true;
    try {
      // Recheck under "lock"
      if (this.ready) {
        throw ReadinessError.flagAlreadyReady();
      }

      const token = new Token(this.nextId++);
      this.tokens.add(token.id);
      return token;
    } finally {
      this.lockHeld = false;
    }
  }

  /**
   * Attempt to mark the flag ready, validated by the provided token.
   *
   * @param token - Authorization token from subscribe()
   * @returns True if the flag was marked ready by this call, false otherwise
   */
  async markReady(token: Token): Promise<boolean> {
    if (this.ready) {
      return false;
    }

    if (token.id === 0) {
      return false; // Never authorize token 0
    }

    this.lockHeld = true;
    try {
      if (!this.tokens.has(token.id)) {
        return false; // Invalid or already used token
      }

      this.tokens.delete(token.id);
      this.ready = true;
      this.tokens.clear(); // No further tokens needed once ready
      this.emitter.emit("ready");
      return true;
    } finally {
      this.lockHeld = false;
    }
  }

  /**
   * Asynchronously wait until the flag becomes ready.
   *
   * @returns Promise that resolves when the flag is ready
   */
  async waitReady(): Promise<void> {
    if (this.isReady()) {
      return;
    }

    return new Promise<void>((resolve) => {
      const onReady = () => {
        resolve();
      };

      this.emitter.once("ready", onReady);

      // Double-check after registering listener
      if (this.isReady()) {
        this.emitter.off("ready", onReady);
        resolve();
      }
    });
  }
}
