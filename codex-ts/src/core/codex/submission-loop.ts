/**
 * Submission loop - processes incoming operations.
 * Port of codex-rs/core/src/codex.rs::submission_loop
 */

import { EventEmitter } from "events";
import type { Session } from "./session.js";
import type { Config } from "../config.js";
import type { Submission } from "../../protocol/protocol.js";
import * as handlers from "./handlers.js";

/**
 * Main submission loop that processes operations until shutdown.
 * Runs in background and routes operations to appropriate handlers.
 *
 * Port of codex.rs::submission_loop
 */
export async function submissionLoop(
  session: Session,
  config: Config,
  rxSub: EventEmitter,
): Promise<void> {
  // Note: running state is managed by listener cleanup

  // Listen for submissions
  const handleSubmission = async (sub: Submission) => {
    console.debug("Submission:", sub);

    try {
      switch (sub.op.type) {
        case "interrupt":
          await handlers.interrupt(session);
          break;

        case "override_turn_context":
          await handlers.overrideTurnContext(session, {
            cwd: sub.op.cwd,
            approvalPolicy: sub.op.approval_policy,
            sandboxPolicy: sub.op.sandbox_policy,
            model: sub.op.model,
            reasoningEffort: sub.op.effort,
            reasoningSummary: sub.op.summary,
          });
          break;

        case "user_input":
        case "user_turn":
          // TODO: await handlers.userInputOrTurn(session, sub.id, sub.op);
          console.warn("user_input/user_turn not yet implemented");
          break;

        case "exec_approval":
          await handlers.execApproval(session, sub.op.id, sub.op.decision);
          break;

        case "patch_approval":
          await handlers.patchApproval(session, sub.op.id, sub.op.decision);
          break;

        case "add_to_history":
          await handlers.addToHistory(session, config, sub.op.text);
          break;

        case "get_history_entry_request":
          // TODO: await handlers.getHistoryEntryRequest(session, config, sub.id, sub.op.offset, sub.op.log_id);
          console.warn("get_history_entry_request not yet implemented");
          break;

        case "list_mcp_tools":
          // TODO: await handlers.listMcpTools(session, config, sub.id);
          console.warn("list_mcp_tools not yet implemented");
          break;

        case "list_custom_prompts":
          // TODO: await handlers.listCustomPrompts(session, sub.id);
          console.warn("list_custom_prompts not yet implemented");
          break;

        case "undo":
          // TODO: await handlers.undo(session, sub.id);
          console.warn("undo not yet implemented");
          break;

        case "compact":
          // TODO: await handlers.compact(session, sub.id);
          console.warn("compact not yet implemented");
          break;

        case "run_user_shell_command":
          // TODO: await handlers.runUserShellCommand(session, sub.id, sub.op.command);
          console.warn("run_user_shell_command not yet implemented");
          break;

        case "shutdown": {
          const shouldShutdown = await handlers.shutdown(session, sub.id);
          if (shouldShutdown) {
            rxSub.removeListener("submission", handleSubmission);
          }
          break;
        }

        case "review":
          // TODO: await handlers.review(session, config, sub.id, sub.op.review_request);
          console.warn("review not yet implemented");
          break;

        default:
          // Ignore unknown ops (enum is non_exhaustive)
          console.warn(
            "Unknown operation type:",
            (sub.op as { type?: string }).type,
          );
          break;
      }
    } catch (err) {
      console.error("Error processing submission:", err);
    }
  };

  rxSub.on("submission", handleSubmission);

  console.debug("Submission loop started");
}
