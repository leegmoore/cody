# Phase 2 Technical Decisions

This document records all technical decisions made during Phase 2 of the TypeScript port.

---

## Decision Log

### [Date] - [Decision Title]

**Context:**

**Decision:**

**Rationale:**

**Alternatives Considered:**

**Consequences:**

---

## Open Questions

### TOML Parsing Library
**Question:** Which TOML parser should we use?

**Options:**
1. **@iarna/toml** - Full TOML 1.0.0, but unmaintained (last update 2021)
2. **smol-toml** - TOML 1.0 compliant, actively maintained (updated Aug 2025)
3. **Custom parser** - Port @iarna/toml later (2K LOC)

**Decision:** Use `smol-toml` (104 KB, zero deps, active maintenance)

**Future:** May fork and maintain our own TOML parser when stable

**Status:** ✅ DECIDED

---

### Rollout File Format
**Question:** Should we maintain exact Rust format or create new?

**Options:**
1. **Match Rust exactly** - JSONL with same structure
2. **New format** - Optimize for TypeScript, breaking compatibility

**Recommendation:** Match Rust exactly for cross-compatibility

**Status:** PENDING

---

### Async Event Pattern
**Question:** How to implement event loop/channels from Rust?

**Rust uses:** `tokio::sync::mpsc` channels

**Options:**
1. **EventEmitter** - Node.js native, familiar pattern
2. **Async Generators** - Modern, composable
3. **RxJS** - Powerful but adds dependency

**Recommendation:** Async Generators (modern, no dependencies)

**Status:** PENDING

---

## Deferred Decisions

_Decisions that can be made in later phases_

- Auth provider implementation details → Phase 5
- MCP server communication protocol → Phase 4
- Command execution sandboxing → Phase 3
