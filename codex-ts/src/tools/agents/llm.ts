/**
 * LLM Chat Tool - OpenRouter Integration
 *
 * Single-shot LLM call using OpenRouter with support for various models.
 */

export interface LLMChatParams {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  model?: string; // Model to use (defaults to TEST_MODEL_FLASH)
  temperature?: number; // Default 0.7
  maxTokens?: number; // Default 2000
  systemPrompt?: string; // Optional system prompt (prepended to messages)
}

export interface LLMChatResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Call LLM via OpenRouter
 */
export async function llmChat(params: LLMChatParams): Promise<LLMChatResult> {
  const {
    messages,
    model = process.env.TEST_MODEL_FLASH || "google/gemini-2.0-flash-001",
    temperature = 0.7,
    maxTokens = 2000,
    systemPrompt,
  } = params;

  // Get API key from environment
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable not set");
  }

  // Build messages array
  const messagesList = [...messages];

  // Prepend system prompt if provided
  if (systemPrompt && messagesList[0]?.role !== "system") {
    messagesList.unshift({ role: "system", content: systemPrompt });
  }

  // Call OpenRouter API
  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://github.com/codex-ts",
        "X-Title": "Codex TypeScript",
      },
      body: JSON.stringify({
        model,
        messages: messagesList,
        temperature,
        max_tokens: maxTokens,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
  }

  const data: unknown = await response.json();

  // Extract response
  type ApiResponse = {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const apiData = data as ApiResponse;
  const content = apiData.choices?.[0]?.message?.content || "";
  const usage = {
    promptTokens: apiData.usage?.prompt_tokens || 0,
    completionTokens: apiData.usage?.completion_tokens || 0,
    totalTokens: apiData.usage?.total_tokens || 0,
  };

  return {
    content,
    model,
    usage,
  };
}
