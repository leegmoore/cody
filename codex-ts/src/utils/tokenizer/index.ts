import { Tiktoken, encoding_for_model, get_encoding } from 'tiktoken';

/**
 * Supported local encodings.
 */
export enum EncodingKind {
  O200kBase = 'o200k_base',
  Cl100kBase = 'cl100k_base',
}

/**
 * Tokenizer error class.
 */
export class TokenizerError extends Error {
  constructor(
    message: string,
    public readonly kind?: EncodingKind,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'TokenizerError';
  }

  static loadEncoding(kind: EncodingKind, cause: Error): TokenizerError {
    return new TokenizerError(`failed to load encoding ${kind}`, kind, cause);
  }

  static decode(cause: Error): TokenizerError {
    return new TokenizerError('failed to decode tokens', undefined, cause);
  }
}

/**
 * Thin wrapper around a tiktoken tokenizer.
 *
 * @example
 * ```typescript
 * const tok = Tokenizer.new(EncodingKind.O200kBase);
 * const tokens = tok.encode("hello world", false);
 * console.log(tokens); // [1234, 5678]
 * const text = tok.decode(tokens);
 * console.log(text); // "hello world"
 * ```
 */
export class Tokenizer {
  private constructor(private readonly inner: Tiktoken) {}

  /**
   * Build a tokenizer for a specific encoding.
   *
   * @param kind - The encoding to use
   * @returns A new Tokenizer instance
   * @throws TokenizerError if the encoding cannot be loaded
   */
  static new(kind: EncodingKind): Tokenizer {
    try {
      const inner = get_encoding(kind);
      return new Tokenizer(inner);
    } catch (error) {
      throw TokenizerError.loadEncoding(kind, error as Error);
    }
  }

  /**
   * Default to O200kBase encoding.
   *
   * @returns A new Tokenizer with O200kBase encoding
   * @throws TokenizerError if the encoding cannot be loaded
   */
  static tryDefault(): Tokenizer {
    return Tokenizer.new(EncodingKind.O200kBase);
  }

  /**
   * Build a tokenizer using an OpenAI model name (maps to an encoding).
   * Falls back to the O200kBase encoding when the model is unknown.
   *
   * @param model - OpenAI model name (e.g., "gpt-5", "gpt-4")
   * @returns A new Tokenizer instance
   * @throws TokenizerError if the fallback encoding cannot be loaded
   */
  static forModel(model: string): Tokenizer {
    try {
      const inner = encoding_for_model(model as any);
      return new Tokenizer(inner);
    } catch (modelError) {
      // Fallback to o200k_base
      try {
        const inner = get_encoding(EncodingKind.O200kBase);
        return new Tokenizer(inner);
      } catch (fallbackError) {
        throw TokenizerError.loadEncoding(
          EncodingKind.O200kBase,
          new Error(
            `fallback after model lookup failure for ${model}: ${modelError}`
          )
        );
      }
    }
  }

  /**
   * Encode text to token IDs. If withSpecialTokens is true, special
   * tokens are allowed and may appear in the result.
   *
   * @param text - Text to encode
   * @param withSpecialTokens - Whether to allow special tokens
   * @returns Array of token IDs as signed 32-bit integers
   */
  encode(text: string, withSpecialTokens: boolean): number[] {
    const raw = withSpecialTokens
      ? this.inner.encode(text, 'all')
      : this.inner.encode(text);
    // tiktoken returns Uint32Array, but we want number[] (signed i32)
    return Array.from(raw);
  }

  /**
   * Count tokens in text as a signed integer.
   *
   * @param text - Text to count tokens for
   * @returns Number of tokens as a signed 64-bit integer (safe integer in JS)
   */
  count(text: string): number {
    const tokens = this.inner.encode(text);
    return tokens.length;
  }

  /**
   * Decode token IDs back to text.
   *
   * @param tokens - Array of token IDs
   * @returns Decoded text
   * @throws TokenizerError if decoding fails
   */
  decode(tokens: number[]): string {
    try {
      // Convert to Uint32Array as expected by tiktoken
      const raw = new Uint32Array(tokens);
      const bytes = this.inner.decode(raw);
      // tiktoken's decode returns Uint8Array of UTF-8 bytes, convert to string
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(bytes);
    } catch (error) {
      throw TokenizerError.decode(error as Error);
    }
  }

  /**
   * Free the tokenizer resources. Call this when done with the tokenizer.
   */
  free(): void {
    this.inner.free();
  }
}
