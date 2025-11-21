# Developer Log

## 2025-11-20 - Phase 1

### Completed
- [x] Added Core 2.0 canonical Zod schemas for Response/OutputItem/StreamEvent in codex-ts.
- [x] Implemented Redis stream client wrapper with MAXLEN handling, consumer helpers, and trace injection.
- [x] Built OpenAI Responses adapter plus verification script with OpenLLMetry bootstrap.

### Challenges
- NodeNext module resolution required explicit `.js` extensions across new modules.
- OpenAI Responses input shape is stricter than chat; normalized inputs to `input_text` blocks.

### Design Decisions
- Publish path injects a shared trace context for every event to preserve spans across Redis.
- Redis wrapper stores full StreamEvent JSON as the stream field to keep parsing deterministic.

### Next Steps
- [ ] Wire projector/Convex reducer to consume `StreamEvent`s.
- [ ] Execute verification script against local Redis/OpenAI to confirm end-to-end flow.
