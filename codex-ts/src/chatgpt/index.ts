/**
 * ChatGPT-specific features for Codex.
 *
 * Simplified implementation for Phase 4.3. Full authentication and
 * git integration will be added in Phase 5.
 *
 * Ported from: codex-rs/chatgpt
 */

// Token management
export type { ChatGptTokenData } from "./token.js";
export {
  getChatGptTokenData,
  setChatGptTokenData,
  clearChatGptTokenData,
  initChatGptTokenFromAuth,
} from "./token.js";

// Get task functionality
export type {
  GetTaskResponse,
  AssistantTurn,
  OutputItem,
  OutputDiff,
} from "./get-task.js";
export { extractDiffFromTask } from "./get-task.js";

// Apply command
export { applyDiffFromTask, getDiffFromTask } from "./apply-command.js";
