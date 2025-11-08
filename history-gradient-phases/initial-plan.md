# Compression Gradient Memory System Project

**Project Goal:** Implement multi-fidelity history with infinite retention through compression gradients.

**Prerequisites:** Core Implementation complete + Script harness complete + Database abstraction added

**Approach:** Incremental compression levels, gradient selection, retrieval tools, extensive capacity testing.

**Output:** Working gradient system + Enhanced CLI history display + Updated library spec

---

## Phase 1: Dual-Level Compression

**Add:**
- Raw + Compressed only (skip S and T initially)
- Compression service (LLM-based)
- Storage for both versions

**Wire:**
- Compression jobs after each turn
- Store R and C in database

**Library Spec:**
- Compression configuration
- Storage abstraction

---

## Phase 2: Simple Gradient

**Add:**
- Two-band gradient (recent R, old C)
- Basic selection logic

**Beef Up:**
- History assembly with tags
- Turn ID display in CLI

**Library Spec:**
- GradientHistoryStrategy interface
- Band configuration

---

## Phase 3: Four-Level System

**Add:**
- Smoothed (S) and Tiny (T) levels
- Full gradient (4 bands)

**Beef Up:**
- Compression quality
- Token estimation

**Library Spec:**
- All compression levels
- Gradient calculator

---

## Phase 4: Fidelity Retrieval

**Add:**
- tools.history.getTurn(id, level)
- Announcement board display
- TTL management

**Wire:**
- Retrieved turns → announcement board
- Expiration logic

**CLI:**
- Show retrieved detail
- Display TTL countdown

**Library Spec:**
- Retrieval tool interface
- Announcement board API

---

## Phase 5: Gradient Optimization

**Add:**
- Dynamic recalculation (every 10 turns)
- Band adjustment logic

**Beef Up:**
- Cache efficiency
- Compression speed

**Library Spec:**
- Gradient tuning options
- Performance configuration

---

## After Phase 5

**Complete:**
- 4-level compression working
- Gradient selection automatic
- Retrieval functional
- 200-400 turns in 100k budget

**Library Spec:**
- Complete gradient API
- History strategy system

**Ready For:** Offline processing project
