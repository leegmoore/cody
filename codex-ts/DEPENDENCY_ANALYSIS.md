# Codex Rust Module Dependency Analysis
## Comprehensive Port Dependencies for TypeScript Port

**Date:** 2025-11-05  
**Analyzed Repository:** /Users/leemoore/code/codex-port-02/codex-rs/  
**Target TypeScript Port:** /Users/leemoore/code/codex-port-02/codex-ts/  

---

## PHASE 2: Configuration & Persistence (Current)

### Module: core/config
**Planned Phase:** Phase 2  
**Size:** ~3,000+ lines (mod.rs, edit.rs, types.rs, profile.rs)  
**Category:** Core infrastructure - CRITICAL PATH

**Internal Dependencies:**
- `crate::auth::AuthCredentialsStoreMode` (Phase 5)
- `crate::config_loader::*` (Phase 2 - sibling)
- `crate::features::*` (Phase 2 - sibling)
- `crate::git_info::resolve_root_git_project_for_trust` (Phase 3 support)
- `crate::model_family::*` (Phase 3 support)
- `crate::model_provider_info::*` (Phase 3 support)
- `crate::openai_model_info::get_model_info` (Phase 4)
- `crate::project_doc::*` (Phase 2 utility)
- `crate::protocol::AskForApproval` (Phase 1 protocol)
- `crate::protocol::SandboxPolicy` (Phase 3)
- `codex_app_server_protocol::Tools` (Phase 5)
- `codex_app_server_protocol::UserSavedConfig` (Phase 5)
- `codex_protocol::config_types::*` (Phase 1 - external)
- `codex_rmcp_client::OAuthCredentialsStoreMode` (Phase 4)

**Blocking Issues:**
⚠️ **CRITICAL CROSS-PHASE DEPENDENCIES:**
- Depends on `crate::openai_model_info` which is Phase 4 functionality
- Depends on `crate::auth::AuthCredentialsStoreMode` which is Phase 5
- Depends on `codex_rmcp_client` which is Phase 4 (MCP client)
- Depends on `codex_app_server_protocol` which is Phase 5

**Recommendation:** These Phase 4/5 dependencies should be refactored into traits or configuration objects to decouple them.

---

### Module: core/config_loader
**Planned Phase:** Phase 2  
**Internal Dependencies:**
- `crate::config::types` (Phase 2 - sibling)
- External: codex_common, toml_edit, serde

**Status:** ✅ NO BLOCKING CROSS-PHASE DEPENDENCIES

---

### Module: core/message_history
**Planned Phase:** Phase 2  
**Internal Dependencies:**
- `crate::config::Config` (Phase 2)
- `crate::config::types::HistoryPersistence` (Phase 2)
- `codex_protocol::ConversationId` (Phase 1 - external)

**Status:** ✅ CLEAN - Only Phase 1/2 dependencies

---

### Module: core/rollout/recorder
**Planned Phase:** Phase 2  
**Internal Dependencies:**
- `crate::config::Config` (Phase 2)
- `crate::default_client::originator` (Phase 4 - Default HTTP client)
- `crate::git_info::collect_git_info` (Phase 3 support)
- `codex_protocol::*` (Phase 1 - external)

**Blocking Issues:**
⚠️ **CROSS-PHASE:** Depends on `crate::default_client` which is Phase 4 (HTTP client setup)

---

### Module: core/rollout/list
**Planned Phase:** Phase 2  
**Internal Dependencies:**
- `codex_file_search::*` (Phase 3 - File search tool)
- `crate::protocol::EventMsg` (Phase 1/internal protocol)
- `codex_protocol::*` (Phase 1 - external)

**Blocking Issues:**
⚠️ **CROSS-PHASE:** Depends on `codex_file_search` which is Phase 3 (standalone tool)

---

## PHASE 3: Execution & Tools

### Module: core/exec
**Planned Phase:** Phase 3  
**Internal Dependencies:**
- `crate::error::*` (Phase 2 utility)
- `crate::protocol::*` (Phase 1/2)
- `crate::sandboxing::*` (Phase 3 - sibling)
- `crate::spawn::*` (Phase 3 - sibling)

**Status:** ✅ NO BLOCKING CROSS-PHASE DEPENDENCIES

---

### Module: exec (standalone crate)
**Planned Phase:** Phase 3  
**Internal Dependencies:**
- `codex_core::auth::enforce_login_restrictions` (Phase 5)
- `codex_core::AuthManager` (Phase 5)
- `codex_core::config::*` (Phase 2)
- `codex_core::ConversationManager` (Deferred)
- `codex_core::find_conversation_path_by_id_str` (Phase 2/rollout)
- `codex_core::git_info::get_git_repo_root` (Phase 3 support)
- `codex_core::NewConversation` (Deferred)
- `codex_core::protocol::*` (Phase 1)
- `codex_ollama::DEFAULT_OSS_MODEL` (Phase 4 - Ollama integration)

**Blocking Issues:**
⚠️ **CRITICAL CROSS-PHASE:**
- Depends on `ConversationManager` (Deferred from Phase 2)
- Depends on `NewConversation` (Deferred from Phase 2)
- Depends on `codex_core::auth::enforce_login_restrictions` (Phase 5)
- Depends on `codex_ollama` (Phase 4)

**Recommendation:** Extract these as injectable dependencies (traits) rather than direct imports.

---

### Module: execpolicy
**Planned Phase:** Phase 3  
**Size:** ~800 lines across multiple files  
**Internal Dependencies:** ✅ NONE - Pure policy parsing logic

**Status:** ✅ FULLY STANDALONE - No internal codex dependencies

---

### Module: file-search
**Planned Phase:** Phase 3  
**Size:** ~600 lines  
**Internal Dependencies:** ✅ NONE - Pure file search with CLI interface

**Status:** ✅ FULLY STANDALONE - Uses external crates only (ignore, nucleo-matcher)

---

### Module: core/tools
**Planned Phase:** Phase 3  
**Size:** ~2,000+ lines across multiple files (mod.rs, context.rs, events.rs, spec.rs, etc.)  
**Internal Dependencies:**
- `crate::conversation_history::*` (Phase 3)
- `crate::exec::ExecToolCallOutput` (Phase 3 - sibling)

**Status:** ✅ MOSTLY ISOLATED - Only Phase 3 internal dependencies

---

### Module: core/sandboxing
**Planned Phase:** Phase 3  
**Internal Dependencies:**
- `crate::exec::*` (Phase 3 - sibling)
- `crate::landlock::*` (Phase 3 - platform specific)
- `crate::protocol::SandboxPolicy` (Phase 1/2)
- `crate::seatbelt::*` (Phase 3 - platform specific)
- `crate::spawn::*` (Phase 3 - sibling)
- `crate::tools::sandboxing::SandboxablePreference` (Phase 3 - sibling)

**Status:** ✅ CONTAINED WITHIN PHASE 3

---

### Module: apply-patch
**Planned Phase:** Phase 3  
**Size:** ~1,600 lines  
**Internal Dependencies:** ✅ NONE - Pure patching logic with tree-sitter

**Status:** ✅ FULLY STANDALONE

---

## PHASE 4: Model Integration & MCP

### Module: core/client
**Planned Phase:** Phase 4  
**Size:** ~1,000+ lines  
**Internal Dependencies:**
- `crate::auth::CodexAuth` (Phase 5)
- `crate::AuthManager` (Phase 5)
- `crate::chat_completions::*` (Phase 4 - sibling)
- `crate::client_common::*` (Phase 4 - sibling)
- `crate::config::Config` (Phase 2)
- `crate::default_client::*` (Phase 4 - sibling)
- `crate::error::*` (Phase 2)
- `crate::flags::*` (Phase 2)
- `crate::model_family::ModelFamily` (Phase 3 support)
- `crate::model_provider_info::ModelProviderInfo` (Phase 3 support)
- `codex_app_server_protocol::AuthMode` (Phase 5)
- `codex_otel::otel_event_manager::OtelEventManager` (Phase 4 - sibling)
- `codex_protocol::*` (Phase 1 - external)

**Blocking Issues:**
⚠️ **CROSS-PHASE:**
- Depends on `crate::auth::CodexAuth` (Phase 5)
- Depends on `crate::AuthManager` (Phase 5)
- Depends on `codex_app_server_protocol::AuthMode` (Phase 5)

**Recommendation:** Use dependency injection for auth-related functionality.

---

### Module: core/chat_completions
**Planned Phase:** Phase 4  
**Internal Dependencies:**
- `crate::client_common::*` (Phase 4 - sibling)
- `crate::default_client::*` (Phase 4 - sibling)
- `crate::error::*` (Phase 2)
- `crate::model_family::ModelFamily` (Phase 3 support)
- `crate::model_provider_info::ModelProviderInfo` (Phase 3 support)
- `crate::tools::spec::create_tools_json_for_chat_completions_api` (Phase 3)
- `codex_otel::otel_event_manager::OtelEventManager` (Phase 4 - sibling)
- `codex_protocol::*` (Phase 1 - external)

**Status:** ✅ NO BLOCKING CROSS-PHASE (Phase 3 dependency is acceptable)

---

### Module: backend-client
**Planned Phase:** Phase 4  
**Size:** ~600 lines  
**Internal Dependencies:**
- `codex_common::CliConfigOverrides` (Phase 1 - utility)
- `codex_core::config::*` (Phase 2)

**Status:** ✅ CLEAN - Phase 2/4 only

---

### Module: mcp-server
**Planned Phase:** Phase 4  
**Size:** ~800+ lines  
**Internal Dependencies:**
- `codex_common::CliConfigOverrides` (Phase 1 - utility)
- `codex_core::config::Config` (Phase 2)

**Status:** ✅ CLEAN - Phase 1/2/4 only

---

### Module: ollama
**Planned Phase:** Phase 4  
**Size:** ~650 lines  
**Internal Dependencies:**
- `codex_core::config::Config` (Phase 2)

**Status:** ✅ CLEAN - Phase 2/4 only

---

### Module: mcp-types
**Planned Phase:** Phase 4  
**Auto-generated:** Via ts-rs  
**Status:** ⚠️ Requires protocol/types completion

---

### Module: rmcp-client
**Planned Phase:** Phase 4  
**Status:** ⚠️ RMCP integration (dependency on rmcp crate)

---

### Module: core/mcp
**Planned Phase:** Phase 4  
**Size:** ~200 lines (auth.rs, mod.rs)  
**Internal Dependencies:**
- All Phase 4 internal only

**Status:** ✅ CONTAINED WITHIN PHASE 4

---

## PHASE 5: CLI, Auth & Polish

### Module: core/auth
**Planned Phase:** Phase 5  
**Internal Dependencies:**
- `crate::config::Config` (Phase 2)
- `crate::error::*` (Phase 2)
- `codex_keyring_store::*` (Phase 5 - sibling)
- `codex_login::*` (Phase 5 - sibling)
- `codex_protocol::*` (Phase 1)

**Status:** ✅ CONTAINED WITHIN PHASE 5

---

### Module: login
**Planned Phase:** Phase 5  
**Status:** OAuth/authentication flow (platform-specific)

---

### Module: keyring-store
**Planned Phase:** Phase 5  
**Status:** OS keyring access (platform-specific)

---

### Module: cli
**Planned Phase:** Phase 5  
**Size:** ~1,000+ lines  
**Internal Dependencies:**
- `codex_common::CliConfigOverrides` (Phase 1)

**Status:** ⚠️ Binary CLI implementation - may need selective porting

---

### Module: app-server
**Planned Phase:** Phase 5  
**Status:** ⚠️ HTTP server with native dependencies

---

### Module: app-server-protocol
**Planned Phase:** Phase 5  
**Status:** Protocol types for app server

---

## DEFERRED FROM PHASE 2: Core Business Logic

### Module: core/codex (3,145 lines)
**Planned Phase:** Deferred  
**CRITICAL DEPENDENCIES:**

**Phase 2/3 Core Dependencies:**
- `crate::config::Config` (Phase 2)
- `crate::conversation_history::ConversationHistory` (Phase 3)
- `crate::environment_context::EnvironmentContext` (Phase 3)
- `crate::exec::StreamOutput` (Phase 3)
- `crate::features::Features` (Phase 2)
- `crate::function_tool::FunctionCallError` (Phase 3)
- `crate::parse_command::parse_command` (Phase 2)
- `crate::tools::ToolRouter` (Phase 3)
- `crate::tools::spec::ToolsConfig` (Phase 3)
- `crate::unified_exec::UnifiedExecSessionManager` (Phase 3)

**Phase 4 Dependencies:**
- `crate::chat_completions::AggregateStreamExt` (Phase 4)
- `crate::chat_completions::stream_chat_completions` (Phase 4)
- `crate::client::ModelClient` (Phase 4)
- `crate::client_common::Prompt` (Phase 4)
- `crate::client_common::ResponseEvent` (Phase 4)
- `crate::client_common::ResponseStream` (Phase 4)
- `crate::mcp_connection_manager::McpConnectionManager` (Phase 4)
- `crate::mcp::auth::compute_auth_statuses` (Phase 4)

**Phase 5 Dependencies:**
- `crate::auth::AuthManager` (Phase 5)
- `crate::user_notification::UserNotification` (Phase 5)

**Blocking Issues:**
🚨 **CRITICAL:** This module requires ALL phases to be functional. It is the orchestrator that ties everything together.

---

### Module: core/codex_conversation
**Planned Phase:** Deferred  
**Internal Dependencies:**
- `crate::codex::Codex` (Deferred - depends on codex.rs)
- `crate::protocol::Event` (Phase 1/2)
- `crate::protocol::Op` (Phase 1/2)
- `crate::protocol::Submission` (Phase 1/2)

**Status:** Blocked by `core/codex`

---

### Module: core/conversation_manager
**Planned Phase:** Deferred  
**Internal Dependencies:**
- `crate::codex_conversation::CodexConversation` (Deferred)
- `crate::codex::Codex` (Deferred)
- `crate::config::Config` (Phase 2)
- `crate::rollout::RolloutRecorder` (Phase 2)
- `codex_protocol::*` (Phase 1)

**Status:** Blocked by `core/codex` and `core/codex_conversation`

---

## PHASE 1: Type Definitions & Utilities (External)

These are in separate `codex-protocol` and `codex-common` crates:

### External Module: codex-protocol
**Status:** ⚠️ Large (~2,887 lines) - Contains core type definitions
- All phase modules depend on `codex_protocol::config_types`
- All phase modules depend on `codex_protocol::models`
- All phase modules depend on `codex_protocol::items`
- All phase modules depend on `codex_protocol::protocol`

### External Module: codex-common
**Status:** ⚠️ Contains utilities used across phases
- CliConfigOverrides
- Config override types
- Sandbox policy types
- Model preset types

---

## CROSS-PHASE DEPENDENCY SUMMARY

### Dependencies Breaking Phase Boundaries:

**Phase 2 → Phase 4:**
- `core/config` depends on `codex_rmcp_client` (MCP client)
- `core/config` depends on `openai_model_info`
- `core/rollout/recorder` depends on `default_client`
- `core/rollout/list` depends on `file_search`

**Phase 3 → Phase 4:**
- `exec` depends on `codex_ollama`
- `exec` depends on `codex_core::auth`

**Phase 3 → Phase 5:**
- `exec` depends on `AuthManager`

**Phase 4 → Phase 5:**
- `core/client` depends on `AuthManager`
- `core/client` depends on `codex_app_server_protocol`

**Phase 2 → Phase 3:**
- `core/config` depends on `git_info`
- `core/config` depends on `model_family` (if Phase 3)
- `core/config` depends on `model_provider_info` (if Phase 3)

---

## CRITICAL PATH ANALYSIS

### Modules That Block The Most Others:

**TIER 1 - Critical Blockers:**
1. **core/config** - Blocks: exec, core/client, chat_completions, all Phase 4+ modules
2. **codex_protocol** - Blocks: ALL modules (external)
3. **codex** - Blocks: codex_conversation, conversation_manager, exec

**TIER 2 - Major Blockers:**
4. **core/tools** - Blocks: codex, most Phase 4 modules
5. **core/exec** - Blocks: codex, unified_exec
6. **core/client** - Blocks: codex, app-server

**TIER 3 - Supporting Blockers:**
7. **core/config_loader** - Blocks: core/config
8. **error module** - Blocks: most modules
9. **protocol types** - Blocks: multiple modules

---

## RECOMMENDED PHASE RESTRUCTURING

### To reduce cross-phase dependencies:

**Option 1: Create Adapter Layer (Recommended)**
- Create Phase 2.5: "Configuration Abstractions"
  - Move auth-related config into trait-based abstraction
  - Move model provider abstractions into separate traits
  - Make these available to Phase 2 without requiring Phase 4/5

**Option 2: Inline Phase 4/5 Utilities**
- Extract minimal HTTP client setup into Phase 2
- Extract minimal auth abstractions into Phase 2
- Keep full implementations in Phase 4/5

**Option 3: Deferred Integration Phase**
- Phase 2: Core config persistence
- Phase 3: Execution tools
- Phase 4: Model clients
- Phase 4.5: Wire everything together (new phase)
- Phase 5: CLI/Auth polish

---

## PORT-SPECIFIC RECOMMENDATIONS

### For TypeScript Port:

1. **Use dependency injection/inversion of control** for cross-phase dependencies
   - Config should accept injectable model info provider
   - Exec should accept injectable auth enforcer
   - Client should accept injectable auth manager

2. **Extract type definitions early**
   - Create comprehensive type definitions before porting logic
   - Mirror codex-protocol structure in TypeScript
   - Consider using TypeScript discriminated unions for protocol types

3. **Refactor before porting Phase 2 modules**
   - Move config dependencies into traits/interfaces
   - Create adapter pattern for external service dependencies
   - This will make porting much cleaner

4. **Prioritize Phase 3 standalone modules**
   - `execpolicy` - Zero dependencies, port first
   - `file-search` - Can use alternative TS library
   - `apply-patch` - Can be ported with tree-sitter-wasm

5. **Deferral strategy**
   - Keep `core/codex`, `core/codex_conversation`, `core/conversation_manager` deferred until all dependencies available
   - These require full integration and can't be tested independently

---

## DETAILED MODULE DEPENDENCY MAP

### By Dependency Direction:

```
Phase 1 (External Types)
  └─ protocol
  └─ common

Phase 2 (Core Infrastructure)
  ├─ config
  │  ├→ Phase 4: openai_model_info, rmcp_client, app_server_protocol
  │  ├→ Phase 5: auth
  │  └→ Phase 3: git_info, model_family
  ├─ config_loader
  ├─ message_history
  └─ rollout
      ├─ recorder (→ Phase 4: default_client, Phase 3: git_info)
      └─ list (→ Phase 3: file_search)

Phase 3 (Execution & Tools)
  ├─ exec
  │  ├→ Phase 4: ollama
  │  ├→ Phase 5: auth, conversation_manager
  │  └─ Phase 3: sandboxing, spawn, tools
  ├─ execpolicy (standalone)
  ├─ file-search (standalone)
  ├─ apply-patch (standalone)
  ├─ core/exec (Phase 3 sibling)
  ├─ core/tools
  └─ core/sandboxing

Phase 4 (Model Integration)
  ├─ client
  │  ├→ Phase 5: auth, app_server_protocol
  │  └─ Phase 4: chat_completions, client_common, default_client
  ├─ chat_completions
  ├─ backend-client
  ├─ mcp-server
  ├─ ollama
  ├─ mcp-types
  ├─ rmcp-client
  └─ core/mcp

Phase 5 (Auth & Polish)
  ├─ core/auth
  ├─ login
  ├─ keyring-store
  ├─ cli
  ├─ app-server
  └─ app-server-protocol

Deferred (Integration)
  ├─ core/codex (requires all phases)
  ├─ core/codex_conversation
  └─ core/conversation_manager
```

---

## IMPLEMENTATION ORDER RECOMMENDATION

### Optimal porting sequence:

1. **Establish type foundations**
   - Port/redefine core protocol types
   - Port config type definitions
   - Set up discriminated unions for events

2. **Phase 3 standalone utilities** (parallel work possible)
   - `execpolicy` - Pure parsing logic
   - `file-search` - Use existing TS library or minimal wrapper
   - `apply-patch` - Port core logic, tree-sitter optional

3. **Phase 2 refactored** (after type foundations)
   - Refactor config to use trait pattern for external deps
   - Port config_loader with new type system
   - Port message_history with clean dependencies
   - Port rollout (with adapter for file-search)

4. **Phase 3 core** (now config is available)
   - Port exec with config dependency
   - Port tools, sandboxing, spawn integration

5. **Phase 4 model clients** (after Phase 3)
   - Port client_common
   - Port chat_completions
   - Port backend-client
   - Port ollama integration

6. **Phase 5 auth/CLI** (final layer)
   - Port auth with keyring abstractions
   - Port CLI command handler

7. **Integration phase**
   - Port codex orchestrator
   - Port conversation_manager
   - Integration testing

---

Generated: 2025-11-05
Analysis Tool: Dependency extraction from actual Rust source files
