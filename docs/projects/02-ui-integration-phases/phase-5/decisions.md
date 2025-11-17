# Phase 5 Decisions

## Rollout storage location
- Persist rollouts under `${codexHome}/sessions/YYYY/MM/DD/rollout-<timestamp>-<id>.jsonl`.
- `codexHome` already defaults to `~/.cody`, so this mirrors the Rust layout and keeps future resume compatibility with other ports.

## Compaction thresholds
- Trigger compaction when total history tokens exceed 80% of the active model context window.
- User messages preserved in the compacted history are capped at 20k tokens; older content is truncated from the middle with a placeholder.

## Summarization model & retries
- Reuse the active conversation `ModelClient` for compaction summaries to keep instructions/model alignment.
- Respect each provider's `streamMaxRetries` setting when summarization fails and back off exponentially starting at 250 ms.
- After retries are exhausted, fall back to the placeholder summary string instead of failing the turn.

## Initial context preservation
- Base instructions, developer overrides, and pinned user instructions are now represented as explicit system/user messages so they survive compaction cycles.

## Compaction audit trail
- Every successful compaction writes a `compacted` entry to the rollout JSONL file containing the summary text and the number of truncated items, giving resume/debug tooling visibility into when and why history was compressed.
