# New CLI Backlog Items

A list of recommended enhancements for the `cody` CLI to improve usability for power users and scripting, based on a review of the current command surface.

---

### 1. Conversation Management

*   **`cody show <id>` Command**
    *   **Justification:** Allow users to view the full transcript of any saved conversation without making it the active session. Provides a critical read-only inspection capability.
    *   **Proposed Signature:** `cody show <conversationId>`

*   **`cody delete <id>` Command**
    *   **Justification:** Allow users to clean up the `~/.cody/conversations` directory by removing old, failed, or temporary conversations.
    *   **Proposed Signature:** `cody delete <conversationId>`

---

### 2. Configuration & State Inspection

*   **`cody status` Command**
    *   **Justification:** Provide a single, script-friendly command to view the complete current state, including the active conversation ID, provider, model, and auth method. Invaluable for debugging and automation.
    *   **Proposed Signature:** `cody status`

---

### 3. Non-Interactive & Scripting Workflows

*   **Piped Input (`stdin`) for `cody chat`**
    *   **Justification:** Enable standard Unix-style piping to provide context to a command (e.g., `cat file.txt | cody chat "summarize this"`), making the CLI a more powerful and idiomatic scripting tool.
    *   **Proposed Signature:** `cody chat <message>` (would automatically detect and prepend piped data).

*   **`--conversation-id` Flag for One-Shot `chat`**
    *   **Justification:** Allow a script to send a single message to any arbitrary saved conversation without needing to `resume` it first, which modifies the active session state. Enables stateless, targeted interactions.
    *   **Proposed Signature:** `cody chat <message> --conversation-id <id>`

---

### 4. Internal Terminology Refactor

*   **Refactor "Model Turn" to "Step"**
    *   **Justification:** Align internal codebase terminology with the newly defined conceptual model where a "Turn" is a complete user-facing interaction, and a "Step" is a single internal request-response cycle with the LLM. This will significantly improve code clarity, reduce ambiguity, and enhance maintainability.
    *   **Proposed Action:** Systematically identify and rename internal variables, functions, and potentially file names that currently refer to "Model Turns" or similar concepts to "Step." Update internal documentation and comments accordingly.