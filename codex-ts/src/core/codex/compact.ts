import type { Prompt } from "../client/client-common.js";
import type { ResponseItem } from "../../protocol/models.js";
import type { Session } from "./session.js";
import type { TurnContext } from "./types.js";

const COMPACT_THRESHOLD_RATIO = 0.8;
const MAX_USER_MESSAGE_TOKENS = 20_000;
const DEFAULT_CONTEXT_WINDOW = 128_000;
const SUMMARY_PREFIX = "Summary of earlier conversation:\n\n";
const SUMMARIZATION_PROMPT = `Please provide a concise summary of the conversation so far.
Focus on:
- Key decisions made
- Important information shared
- Current state of work
- Any unresolved issues or next steps

Keep the summary under 500 tokens.`;
const MAX_TRUNCATION_ATTEMPTS = 20;
const BACKOFF_MS = 250;

interface CompactConfig {
  thresholdRatio: number;
  maxUserMessageTokens: number;
}

const DEFAULT_COMPACT_CONFIG: CompactConfig = {
  thresholdRatio: COMPACT_THRESHOLD_RATIO,
  maxUserMessageTokens: MAX_USER_MESSAGE_TOKENS,
};

export function needsCompaction(
  history: ResponseItem[],
  contextWindow: number,
  config: CompactConfig = DEFAULT_COMPACT_CONFIG,
): boolean {
  if (!contextWindow) {
    return false;
  }
  const tokenBudget = Math.floor(contextWindow * config.thresholdRatio);
  const tokens = countHistoryTokens(history);
  return tokens > tokenBudget;
}

export async function runCompactTask(
  session: Session,
  turnContext: TurnContext,
): Promise<void> {
  const contextWindow =
    turnContext.modelContextWindow ?? DEFAULT_CONTEXT_WINDOW;
  let history = session.getHistory();
  const initialContext = session.getInitialContext();
  const protectedInitialCount = initialContext.length;
  if (!needsCompaction(history, contextWindow)) {
    return;
  }

  for (let attempt = 0; attempt <= MAX_TRUNCATION_ATTEMPTS; attempt += 1) {
    const summary = await getSummary(session, turnContext, history);
    const userMessages = collectUserMessages(history);
    const selectedMessages = selectRecentMessages(
      userMessages,
      DEFAULT_COMPACT_CONFIG.maxUserMessageTokens,
    );
    const compacted = buildCompactedHistory(
      initialContext,
      selectedMessages,
      summary,
    );
    const ghosts = extractGhostSnapshots(history);
    const combined = [...compacted, ...ghosts];
    const { history: finalHistory, truncatedCount } = ensureWithinWindow(
      combined,
      contextWindow,
      protectedInitialCount,
    );

    if (!needsCompaction(finalHistory, contextWindow)) {
      session.replaceHistory(finalHistory);
      const recorder = session.getRolloutRecorder();
      if (recorder) {
        await recorder.appendCompacted({
          summary,
          truncatedCount,
          timestamp: Date.now(),
        });
      }
      return;
    }

    const dropGuard = historyStartsWithInitial(history, initialContext)
      ? protectedInitialCount
      : 0;
    const nextHistory = dropOldestDroppable(history, dropGuard);
    history = nextHistory.items;
    if (!nextHistory.removed || history.length === 0) {
      break;
    }
  }

  console.warn(
    "Compaction was unable to reduce history below the model context window.",
  );
}

async function getSummary(
  session: Session,
  turnContext: TurnContext,
  history: ResponseItem[],
): Promise<string> {
  const client = session.getModelClient();
  const prompt: Prompt = {
    input: buildSummaryPrompt(history),
    tools: [],
    parallelToolCalls: false,
  };

  const maxRetries = getMaxRetries(turnContext);
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await client.sendMessage(prompt);
      const text = extractTextFromResponse(response);
      if (text.trim().length > 0) {
        return text.trim();
      }
      break;
    } catch (error) {
      if (attempt === maxRetries) {
        console.warn("Failed to summarize conversation history:", error);
        break;
      }
      await sleep(BACKOFF_MS * 2 ** attempt);
    }
  }

  return "(summary unavailable)";
}

function buildSummaryPrompt(history: ResponseItem[]): ResponseItem[] {
  const items: ResponseItem[] = history
    .filter(
      (item): item is Extract<ResponseItem, { type: "message" }> =>
        item.type === "message",
    )
    .map((item) => ({
      type: "message",
      role: item.role,
      content: item.content,
    }));

  items.push(createUserMessage(SUMMARIZATION_PROMPT));
  return items;
}

function extractTextFromResponse(items: ResponseItem[]): string {
  for (const item of items) {
    if (item.type !== "message") {
      continue;
    }
    const texts = item.content
      .filter(
        (content) =>
          content.type === "output_text" || content.type === "input_text",
      )
      .map((content) => content.text)
      .join("\n");
    if (texts.trim().length > 0) {
      return texts;
    }
  }
  return "";
}

export function collectUserMessages(history: ResponseItem[]): string[] {
  const texts: string[] = [];
  for (const item of history) {
    if (item.type !== "message" || item.role !== "user") {
      continue;
    }
    const text = item.content
      .filter(
        (content) =>
          content.type === "input_text" || content.type === "output_text",
      )
      .map((content) => content.text)
      .join("\n");
    if (text.trim().length > 0) {
      texts.push(text);
    }
  }
  return texts;
}

export function selectRecentMessages(
  messages: string[],
  maxTokens: number = DEFAULT_COMPACT_CONFIG.maxUserMessageTokens,
): string[] {
  const selected: string[] = [];
  let remaining = maxTokens;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    const tokens = countTextTokens(message);
    if (tokens <= remaining) {
      selected.unshift(message);
      remaining -= tokens;
      continue;
    }
    if (remaining <= 0) {
      break;
    }
    selected.unshift(truncateMiddle(message, remaining));
    remaining = 0;
    break;
  }
  return selected;
}

export function truncateMiddle(text: string, maxTokens: number): string {
  const tokens = countTextTokens(text);
  if (tokens <= maxTokens) {
    return text;
  }
  if (maxTokens <= 0) {
    return "";
  }
  const estimatedChars = maxTokens * 4;
  const headChars = Math.floor(estimatedChars * 0.4);
  const tailChars = Math.floor(estimatedChars * 0.4);
  const head = text.slice(0, headChars);
  const tail = text.slice(Math.max(text.length - tailChars, 0));
  const removed = text.length - (head.length + tail.length);
  return `${head}\n\n[... ${removed} characters truncated ...]\n\n${tail}`;
}

function buildCompactedHistory(
  initialContext: ResponseItem[],
  userMessages: string[],
  summary: string,
): ResponseItem[] {
  const history: ResponseItem[] = [...initialContext];
  for (const message of userMessages) {
    history.push(createUserMessage(message));
  }
  history.push(createUserMessage(`${SUMMARY_PREFIX}${summary}`));
  return history;
}

function createUserMessage(text: string): ResponseItem {
  return {
    type: "message",
    role: "user",
    content: [{ type: "input_text", text }],
  };
}

function extractGhostSnapshots(history: ResponseItem[]): ResponseItem[] {
  return history.filter((item) => item.type === "ghost_snapshot");
}

function ensureWithinWindow(
  history: ResponseItem[],
  contextWindow: number,
  protectedPrefixCount = 0,
): { history: ResponseItem[]; truncatedCount: number } {
  const items = [...history];
  let truncated = 0;
  while (needsCompaction(items, contextWindow)) {
    const removableIndex = items.findIndex(
      (item, index) => index >= protectedPrefixCount && isDroppableItem(item),
    );
    if (removableIndex === -1) {
      break;
    }
    items.splice(removableIndex, 1);
    truncated += 1;
  }
  return { history: items, truncatedCount: truncated };
}

function isSummaryMessage(item: ResponseItem): boolean {
  if (item.type !== "message" || item.role !== "user") {
    return false;
  }
  return item.content.some(
    (content) =>
      (content.type === "input_text" || content.type === "output_text") &&
      content.text.startsWith(SUMMARY_PREFIX),
  );
}

function countHistoryTokens(history: ResponseItem[]): number {
  return history.reduce((total, item) => total + countItemTokens(item), 0);
}

function countItemTokens(item: ResponseItem): number {
  if (item.type === "message") {
    return item.content.reduce((sum, content) => {
      if (content.type === "input_text" || content.type === "output_text") {
        return sum + countTextTokens(content.text);
      }
      return sum + 4;
    }, 0);
  }
  if (item.type === "ghost_snapshot") {
    return 50;
  }
  return Math.max(10, JSON.stringify(item).length / 4);
}

function countTextTokens(text: string): number {
  if (!text) {
    return 0;
  }
  return Math.max(1, Math.ceil(text.length / 4));
}

function dropOldestDroppable(
  history: ResponseItem[],
  protectedPrefixCount = 0,
): { items: ResponseItem[]; removed: boolean } {
  const copy = [...history];
  const idx = copy.findIndex(
    (item, index) => index >= protectedPrefixCount && isDroppableItem(item),
  );
  if (idx >= 0) {
    copy.splice(idx, 1);
    return { items: copy, removed: true };
  }
  return { items: copy, removed: false };
}

function isDroppableItem(item: ResponseItem): boolean {
  if (item.type !== "message") {
    return false;
  }
  if (item.role !== "user" && item.role !== "assistant") {
    return false;
  }
  return !isSummaryMessage(item);
}

function getMaxRetries(turnContext: TurnContext): number {
  const provider = turnContext.client?.getProvider();
  const configured = provider?.streamMaxRetries;
  if (configured === undefined || configured === null) {
    return 3;
  }
  return Math.max(0, configured);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function historyStartsWithInitial(
  history: ResponseItem[],
  initialContext: ResponseItem[],
): boolean {
  if (initialContext.length === 0) {
    return false;
  }
  if (history.length < initialContext.length) {
    return false;
  }
  return initialContext.every((contextItem, index) => {
    const existing = history[index];
    if (!existing) {
      return false;
    }
    return JSON.stringify(existing) === JSON.stringify(contextItem);
  });
}
