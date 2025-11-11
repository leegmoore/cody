import { createToolsJsonForResponsesApi } from "../tool-converters.js";
import {
  createTextParamForRequest,
  type Prompt,
  type ResponsesApiRequest,
} from "../client-common.js";
import {
  getFullUrl,
  isAzureResponsesEndpoint,
  type ModelProviderInfo,
} from "../model-provider-info.js";
import type {
  ReasoningEffort,
  ReasoningSummary,
} from "../../../protocol/config-types.js";
import type { ContentItem, ResponseItem } from "../../../protocol/models.js";

interface ResponsesClientOptions {
  provider: ModelProviderInfo;
  model: string;
  apiKey: string;
  reasoningEffort?: ReasoningEffort;
  reasoningSummary: ReasoningSummary;
  instructions?: string;
}

interface ResponsesContentBlock {
  type: string;
  text?: string;
  image_url?: string;
}

interface ResponsesOutputItem {
  type: string;
  role?: string;
  content?: ResponsesContentBlock[];
}

interface ResponsesApiResponse {
  output?: ResponsesOutputItem[];
  response?: {
    output?: ResponsesOutputItem[];
  };
  error?: {
    message?: string;
  };
}

const DEFAULT_RESPONSES_INSTRUCTIONS = "You are Cody, a helpful AI assistant.";

export async function sendResponsesRequest(
  prompt: Prompt,
  options: ResponsesClientOptions,
): Promise<ResponseItem[]> {
  const endpoint = getFullUrl(options.provider);
  const headers = buildHeaders(options.provider, options.apiKey);
  const requestBody = buildRequestBody(prompt, options);

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  const rawBody = await response.text();
  if (!response.ok) {
    const message = extractErrorMessage(rawBody);
    throw new Error(
      `Responses API request failed (${response.status}): ${message}`,
    );
  }

  const payload = parseJson(rawBody);
  const output = payload.output ?? payload.response?.output ?? [];
  return mapOutputToResponseItems(output);
}

function buildRequestBody(
  prompt: Prompt,
  options: ResponsesClientOptions,
): ResponsesApiRequest {
  const instructions =
    prompt.baseInstructionsOverride ??
    options.instructions ??
    DEFAULT_RESPONSES_INSTRUCTIONS;

  const request: ResponsesApiRequest = {
    model: options.model,
    instructions,
    input: prompt.input,
    tools: createToolsJsonForResponsesApi(prompt.tools),
    tool_choice: "auto",
    parallel_tool_calls: prompt.parallelToolCalls,
    reasoning: buildReasoning(options),
    store: false,
    stream: false,
    include: [],
  };

  if (prompt.outputSchema) {
    request.text = createTextParamForRequest(undefined, prompt.outputSchema);
  }

  return request;
}

function buildReasoning({
  reasoningEffort,
  reasoningSummary,
}: ResponsesClientOptions): ResponsesApiRequest["reasoning"] {
  if (!reasoningEffort && !reasoningSummary) {
    return undefined;
  }

  return {
    effort: reasoningEffort,
    summary: reasoningSummary,
  };
}

function buildHeaders(
  provider: ModelProviderInfo,
  apiKey: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (isAzureResponsesEndpoint(provider)) {
    headers["api-key"] = apiKey;
  } else {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  headers["OpenAI-Beta"] = headers["OpenAI-Beta"] ?? "assistants=v2";

  if (provider.httpHeaders) {
    for (const [key, value] of Object.entries(provider.httpHeaders)) {
      headers[key] = value;
    }
  }

  if (provider.envHttpHeaders) {
    for (const [key, envVar] of Object.entries(provider.envHttpHeaders)) {
      const value = process.env[envVar];
      if (value) {
        headers[key] = value;
      }
    }
  }

  return headers;
}

function parseJson(body: string): ResponsesApiResponse {
  try {
    return JSON.parse(body) as ResponsesApiResponse;
  } catch (error) {
    throw new Error(`Failed to parse Responses API payload: ${String(error)}`);
  }
}

function extractErrorMessage(body: string): string {
  try {
    const payload = JSON.parse(body) as ResponsesApiResponse;
    return payload.error?.message ?? body;
  } catch {
    return body;
  }
}

function mapOutputToResponseItems(
  output: ResponsesOutputItem[],
): ResponseItem[] {
  const items: ResponseItem[] = [];

  for (const entry of output) {
    if (entry.type === "message" && entry.role && entry.content) {
      const content = entry.content
        .map(mapContentBlock)
        .filter((block): block is ContentItem => Boolean(block));
      if (content.length > 0) {
        items.push({
          type: "message",
          role: entry.role,
          content,
        });
      }
    }
  }

  return items;
}

function mapContentBlock(
  block: ResponsesContentBlock,
): ContentItem | undefined {
  if (
    (block.type === "output_text" || block.type === "input_text") &&
    typeof block.text === "string"
  ) {
    return {
      type: block.type,
      text: block.text,
    } as ContentItem;
  }

  if (block.type === "input_image" && typeof block.image_url === "string") {
    return {
      type: "input_image",
      image_url: block.image_url,
    } as ContentItem;
  }

  return undefined;
}
