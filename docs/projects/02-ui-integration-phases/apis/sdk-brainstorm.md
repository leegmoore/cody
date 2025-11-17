# SDK Brainstorm: Low-Level Primitives (Level 1)

A raw dump of the core, low-level operations that should be exposed by the base NPM library. This serves as the primitive layer upon which higher-level SDK methods and the REST API can be built.

---

| Functional Area | Component | Primitive Operation (Method Signature) | Description |
| :--- | :--- |:---| :--- |
| **Conversation** | `ConversationManager` | `async newConversation(config: Config): NewConversation` | Creates a new conversation instance from a full config object. |
| | `ConversationManager` | `async resumeConversation(id: string): Conversation` | Loads a persisted conversation from storage by its ID and reconstructs its state. |
| | `ConversationManager` | `async listConversations(): ConversationMetadata[]` | Lists metadata for all persisted conversations (ID, timestamp, etc.). |
| | `ConversationManager` | `async getConversation(id: string): Conversation` | Retrieves an already active (in-memory) conversation object. |
| | `ConversationManager` | `async deleteConversation(id: string): void` | Deletes a persisted conversation from storage. *(From backlog)* |
| | `Conversation` | `async submit(message: string): Response` | Submits a user message to an active conversation and returns the complete final response (after tool loops, etc.). |
| | `Conversation` | `getHistory(): ResponseItem[]` | Returns the current array of all `ResponseItem`s in the conversation's history. |
| | `Conversation` | `showHistory(): string` | Returns a formatted string transcript of the conversation. *(From backlog)* |
| | `Compact` | `async runCompactTask(session: Session): void` | Manually triggers the history compression algorithm on a given session. (Likely an internal tool, but could be exposed). |
| **Configuration** | `ConfigLoader`| `async getConfig(): Config` | Reads and returns the entire merged `config.toml` object. |
| | `ConfigLoader`| `async setConfig(key: string, value: any): void` | Sets a specific key-value pair in the user's `config.toml` file. |
| | `ConfigLoader`| `async getActiveProvider(): ProviderInfo` | A helper to get the full info for the currently configured provider. |
| | `ConfigLoader`| `async getActiveAuth(): AuthInfo` | A helper to get the full info for the currently configured auth method. |
| **Authentication**| `AuthManager` | `async getToken(provider: string): string` | Retrieves the correct token for a given provider based on the active auth method in the config. |
| | `AuthManager` | `async getStatus(): AuthStatus[]` | Checks the availability and status of all potential auth methods (e.g., key present, token file exists). |
