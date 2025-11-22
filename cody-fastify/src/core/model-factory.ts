import { AnthropicStreamAdapter } from "./adapters/anthropic-adapter.js";
import { OpenAIStreamAdapter } from "./adapters/openai-adapter.js";
import { RedisStream } from "./redis.js";
import type { TraceContext } from "./schema.js";

/**
 * Canonical list of provider/model pairs that the harness is allowed to use.
 * The set is intentionally small to match the guidance in GEMINI/GEM docs.
 */
const VALID_PROVIDER_MODELS = {
  openai: new Set(["gpt-5-mini", "gpt-5-codex"]),
  anthropic: new Set(["claude-haiku-4.5", "claude-sonnet-4.5"]),
} as const;

type SupportedProvider = keyof typeof VALID_PROVIDER_MODELS;

/**
 * Parameters passed to adapters when initiating a stream.
 */
export interface StreamAdapterParams {
  prompt: string;
  runId?: string;
  turnId?: string;
  threadId?: string;
  agentId?: string;
  traceContext?: TraceContext;
}

/**
 * Minimal contract that both real and mock adapters must satisfy.
 */
export interface StreamAdapter {
  stream(params: StreamAdapterParams): Promise<{ runId: string }>;
}

export interface CreateAdapterOptions {
  providerId: string;
  model: string;
  redis: RedisStream;
}

export interface ModelFactory {
  createAdapter(options: CreateAdapterOptions): StreamAdapter;
}

export class UnknownProviderError extends Error {
  constructor(public readonly providerId: string) {
    super(`Unknown provider "${providerId}"`);
    this.name = "UnknownProviderError";
  }
}

export class InvalidModelError extends Error {
  constructor(
    public readonly providerId: string,
    public readonly model: string,
  ) {
    super(
      `Model "${model}" is not allowed for provider "${providerId}". ` +
        `Allowed models: ${Array.from(
          VALID_PROVIDER_MODELS[providerId as SupportedProvider] ?? [],
        ).join(", ")}`,
    );
    this.name = "InvalidModelError";
  }
}

export interface DefaultModelFactoryOptions {
  openai?: {
    apiKey?: string;
    baseUrl?: string;
  };
  anthropic?: {
    apiKey?: string;
    baseUrl?: string;
    maxOutputTokens?: number;
  };
}

/**
 * Production factory that creates real provider adapters.
 */
export class DefaultModelFactory implements ModelFactory {
  private readonly options: DefaultModelFactoryOptions;

  constructor(options: DefaultModelFactoryOptions = {}) {
    this.options = options;
  }

  createAdapter(options: CreateAdapterOptions): StreamAdapter {
    const provider = normalizeProvider(options.providerId);
    assertModelAllowed(provider, options.model);

    if (provider === "openai") {
      return new OpenAIStreamAdapter({
        model: options.model,
        providerId: provider,
        redis: options.redis,
        apiKey: this.options.openai?.apiKey,
        baseUrl: this.options.openai?.baseUrl,
      });
    }

    return new AnthropicStreamAdapter({
      model: options.model,
      providerId: provider,
      redis: options.redis,
      apiKey: this.options.anthropic?.apiKey,
      baseUrl: this.options.anthropic?.baseUrl,
      maxOutputTokens: this.options.anthropic?.maxOutputTokens,
    });
  }
}

export interface FixtureRegistration {
  filePath: string;
  description?: string;
  prompt?: string;
  scenarioId?: string;
  eventDelayMs?: number;
}

type FixtureResolver = (prompt: string) => FixtureRegistration | undefined;

export interface MockAdapterFactoryInput {
  providerId: string;
  model: string;
  redis: RedisStream;
  resolveFixture: FixtureResolver;
}

export type MockAdapterFactory = (
  input: MockAdapterFactoryInput,
) => StreamAdapter;

export interface RegisterFixtureOptions extends FixtureRegistration {
  providerId: string;
  model: string;
  prompt?: string;
  isDefault?: boolean;
}

export interface MockModelFactoryOptions {
  adapterFactory: MockAdapterFactory;
  defaultEventDelayMs?: number;
}

type FixtureBucket = {
  byPrompt: Map<string, FixtureRegistration>;
  defaultFixture?: FixtureRegistration;
};

/**
 * Test-only factory that resolves adapters backed by deterministic fixtures.
 * The actual adapter implementation is injected so this module does not depend
 * on tests directly.
 */
export class MockModelFactory implements ModelFactory {
  private readonly adapterFactory: MockAdapterFactory;
  private readonly defaultEventDelayMs: number;
  private readonly fixtures = new Map<string, FixtureBucket>();

  constructor(options: MockModelFactoryOptions) {
    this.adapterFactory = options.adapterFactory;
    this.defaultEventDelayMs = options.defaultEventDelayMs ?? 0;
  }

  registerFixture(options: RegisterFixtureOptions): void {
    const provider = normalizeProvider(options.providerId);
    assertModelAllowed(provider, options.model);

    const key = bucketKey(provider, options.model);
    const bucket = this.fixtures.get(key) ?? {
      byPrompt: new Map<string, FixtureRegistration>(),
    };

    const registration: FixtureRegistration = {
      filePath: options.filePath,
      description: options.description,
      prompt: options.prompt,
      scenarioId: options.scenarioId,
      eventDelayMs: options.eventDelayMs ?? this.defaultEventDelayMs,
    };

    if (options.isDefault || !options.prompt) {
      bucket.defaultFixture = registration;
    }

    if (options.prompt) {
      bucket.byPrompt.set(options.prompt, registration);
    }

    this.fixtures.set(key, bucket);
  }

  getFixture(
    providerId: string,
    model: string,
    prompt: string,
  ): FixtureRegistration | undefined {
    const provider = normalizeProvider(providerId);
    assertModelAllowed(provider, model);
    const bucket = this.fixtures.get(bucketKey(provider, model));
    if (!bucket) return undefined;
    return bucket.byPrompt.get(prompt) ?? bucket.defaultFixture;
  }

  createAdapter(options: CreateAdapterOptions): StreamAdapter {
    const provider = normalizeProvider(options.providerId);
    assertModelAllowed(provider, options.model);

    const key = bucketKey(provider, options.model);
    const bucket = this.fixtures.get(key);
    if (!bucket) {
      throw new Error(
        `No mock fixtures registered for provider "${provider}" and model "${options.model}"`,
      );
    }

    const resolveFixture: FixtureResolver = (prompt: string) => {
      return bucket.byPrompt.get(prompt) ?? bucket.defaultFixture;
    };

    return this.adapterFactory({
      providerId: provider,
      model: options.model,
      redis: options.redis,
      resolveFixture,
    });
  }
}

function normalizeProvider(providerId: string): SupportedProvider {
  const normalized = providerId.trim().toLowerCase();
  if (normalized === "openai" || normalized === "anthropic") {
    return normalized;
  }
  throw new UnknownProviderError(providerId);
}

function assertModelAllowed(provider: SupportedProvider, model: string): void {
  const allowed = VALID_PROVIDER_MODELS[provider];
  if (!allowed.has(model)) {
    throw new InvalidModelError(provider, model);
  }
}

function bucketKey(provider: SupportedProvider, model: string): string {
  return `${provider}:${model}`;
}

export { VALID_PROVIDER_MODELS };
