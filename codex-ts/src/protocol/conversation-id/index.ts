import {
  v7 as uuidv7,
  parse as uuidParse,
  stringify as uuidStringify,
} from "uuid";

/**
 * Unique identifier for a conversation, using UUIDv7.
 *
 * UUIDv7 provides time-ordered unique identifiers that are suitable for use
 * as conversation IDs. The timestamp component allows for efficient indexing
 * and sorting by creation time.
 *
 * @example
 * ```typescript
 * const id = new ConversationId();
 * console.log(id.toString()); // "01234567-89ab-7def-0123-456789abcdef"
 *
 * const parsed = ConversationId.fromString("01234567-89ab-7def-0123-456789abcdef");
 * ```
 */
export class ConversationId {
  private readonly uuid: Uint8Array;

  /**
   * Create a new conversation ID with a UUIDv7.
   */
  constructor(uuid?: Uint8Array) {
    if (uuid) {
      this.uuid = uuid;
    } else {
      this.uuid = uuidv7({}, new Uint8Array(16));
    }
  }

  /**
   * Create a new conversation ID (same as constructor).
   *
   * @returns A new ConversationId with a UUIDv7
   */
  static new(): ConversationId {
    return new ConversationId();
  }

  /**
   * Create a ConversationId from a UUID string.
   *
   * @param s - UUID string in standard format (e.g., "550e8400-e29b-41d4-a716-446655440000")
   * @returns ConversationId instance
   * @throws Error if the string is not a valid UUID
   */
  static fromString(s: string): ConversationId {
    try {
      const bytes = uuidParse(s);
      return new ConversationId(bytes);
    } catch (error) {
      throw new Error(`Invalid UUID string: ${s}`);
    }
  }

  /**
   * Create a default conversation ID (generates a new one).
   *
   * @returns A new ConversationId
   */
  static default(): ConversationId {
    return new ConversationId();
  }

  /**
   * Convert the conversation ID to a string.
   *
   * @returns UUID string representation
   */
  toString(): string {
    return uuidStringify(this.uuid);
  }

  /**
   * Convert to JSON (returns the string representation).
   *
   * @returns UUID string
   */
  toJSON(): string {
    return this.toString();
  }

  /**
   * Check if this conversation ID equals another.
   *
   * @param other - Another ConversationId to compare with
   * @returns True if the UUIDs are equal
   */
  equals(other: ConversationId): boolean {
    if (this.uuid.length !== other.uuid.length) {
      return false;
    }
    for (let i = 0; i < this.uuid.length; i++) {
      if (this.uuid[i] !== other.uuid[i]) {
        return false;
      }
    }
    return true;
  }
}
