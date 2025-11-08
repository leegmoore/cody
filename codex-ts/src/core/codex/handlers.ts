/**
 * Operation handlers for the submission loop.
 * Port of codex-rs/core/src/codex.rs::handlers
 */

import type { Session } from "./session.js";
import type { Config } from "../config.js";
import type { SessionSettingsUpdate } from "./types.js";
import type { ReviewDecision, EventMsg } from "../../protocol/protocol.js";

/**
 * Handle Interrupt operation.
 * Port of handlers::interrupt
 */
export async function interrupt(session: Session): Promise<void> {
  await session.interruptTask();
}

/**
 * Handle OverrideTurnContext operation.
 * Port of handlers::override_turn_context
 */
export async function overrideTurnContext(
  session: Session,
  updates: SessionSettingsUpdate,
): Promise<void> {
  await session.updateSettings(updates);
}

/**
 * Handle ExecApproval operation.
 * Port of handlers::exec_approval
 */
export async function execApproval(
  session: Session,
  id: string,
  decision: ReviewDecision,
): Promise<void> {
  if (decision === "abort") {
    await session.interruptTask();
  } else {
    await session.notifyApproval(id, decision);
  }
}

/**
 * Handle PatchApproval operation.
 * Port of handlers::patch_approval
 */
export async function patchApproval(
  session: Session,
  id: string,
  decision: ReviewDecision,
): Promise<void> {
  if (decision === "abort") {
    await session.interruptTask();
  } else {
    await session.notifyApproval(id, decision);
  }
}

/**
 * Handle AddToHistory operation.
 * Port of handlers::add_to_history
 */
export async function addToHistory(
  session: Session,
  _config: Config,
  text: string,
): Promise<void> {
  const conversationId = session.conversationId;

  // Spawn background task to append to message history
  // TODO: Import and call message_history::append_entry
  console.warn("addToHistory: not yet implemented", { conversationId, text });
}

/**
 * Handle Shutdown operation.
 * Port of handlers::shutdown
 * Returns true if loop should exit.
 */
export async function shutdown(
  session: Session,
  subId: string,
): Promise<boolean> {
  // TODO: await session.abortAllTasks(TurnAbortReason.Interrupted);
  console.info("Shutting down Codex instance");

  // Flush rollout recorder
  await session.flushRollout();

  // TODO: Gracefully shutdown rollout recorder
  // const recorder = session.services.rollout.value;
  // if (recorder) {
  //   await recorder.shutdown();
  // }

  // Send shutdown complete event
  const event: EventMsg = {
    type: "shutdown_complete",
  };
  await session.sendEvent(subId, event);

  return true;
}

// TODO: Port remaining handlers in future sections:
// - userInputOrTurn
// - runUserShellCommand
// - getHistoryEntryRequest
// - listMcpTools
// - listCustomPrompts
// - undo
// - compact
// - review
