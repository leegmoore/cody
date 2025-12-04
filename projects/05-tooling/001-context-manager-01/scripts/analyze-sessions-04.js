#!/usr/bin/env node
/* eslint-disable no-console */
// Node script to analyze Claude Code JSONL session files.
// Usage: node analyze-sessions-04.js <absPath1.jsonl> <absPath2.jsonl> ...
// Outputs a single JSON summary to stdout.
const fs = require("fs");
const path = require("path");

function safeParse(line, idx, file) {
  try {
    return JSON.parse(line);
  } catch (e) {
    return { __parse_error: true, lineNumber: idx + 1, error: String(e), raw: line };
  }
}

function addToCount(map, key, inc = 1) {
  if (!key && key !== 0) return;
  map[key] = (map[key] || 0) + inc;
}

function addToSet(set, value) {
  if (value === undefined || value === null) return;
  set.add(value);
}

function unionKeys(targetSet, obj) {
  if (!obj || typeof obj !== "object") return;
  for (const k of Object.keys(obj)) {
    targetSet.add(k);
  }
}

function summarizeFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const lineCount = lines.length;

  const entryTypeCounts = {};
  const roleCounts = {};
  const modelCounts = {};
  const stopReasonCounts = {};
  const stopSequenceCounts = {};
  const contentBlockTypeCounts = {};
  const messageIdOccurrences = {};
  const toolUseIds = new Set();
  const toolResultIds = new Set(); // tool_result.tool_use_id values
  const toolUseIdToAssistantMessageId = new Map();
  const toolResultIdToUserEntryIndex = new Map();
  const orphanToolUses = new Set();
  const orphanToolResults = new Set();

  const versionCounts = {};
  const rootKeysByType = {};
  const messageKeys = new Set();
  const usageKeys = new Set();
  const contentBlockKeysByType = {}; // type -> Set(keys)

  // UUID chain stats
  let prevUuid = null;
  let uuidPresentCount = 0;
  let uuidMissingCount = 0;
  let parentUuidPresentCount = 0;
  let parentUuidMissingCount = 0;
  let parentUuidEqualsPrevCount = 0;
  let parentUuidNotEqualPrevCount = 0;
  let uuidNullCount = 0;
  let parentUuidNullCount = 0;

  // Turn detection
  let turns = 0;
  const perTurn = []; // {startIndex, endIndex, toolUseCount, toolResultCount, loopsMatched}
  let inTurn = false;
  let currentTurn = null;
  let currentTurnToolUseIds = new Set();
  let currentTurnToolResultIds = new Set();

  // Keep minimal samples for entry types (first seen)
  const sampleByEntryType = {};

  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const parsed = safeParse(lines[i], i, filePath);
    if (parsed.__parse_error) {
      entries.push(parsed);
      continue;
    }
    entries.push(parsed);
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const type = entry.type;
    addToCount(entryTypeCounts, type);

    // version field
    addToCount(versionCounts, entry.version);

    // root keys by type
    if (type) {
      rootKeysByType[type] = rootKeysByType[type] || new Set();
      unionKeys(rootKeysByType[type], entry);
    }

    // save one sample per type (shallow clone with trimmed content)
    if (type && !sampleByEntryType[type]) {
      const clone = JSON.parse(JSON.stringify(entry));
      if (clone.message && Array.isArray(clone.message.content)) {
        // keep only first 1-2 content blocks with keys, drop large payloads
        clone.message.content = clone.message.content.slice(0, 2).map((b) => {
          const small = {};
          for (const k of Object.keys(b)) {
            if (k === "text" && typeof b.text === "string") {
              small.text = b.text.length > 120 ? b.text.slice(0, 120) + "..." : b.text;
            } else if (k === "content" && typeof b.content === "string") {
              small.content = b.content.length > 120 ? b.content.slice(0, 120) + "..." : b.content;
            } else if (k === "data" && typeof b.data === "string") {
              small.data = b.data.length > 120 ? b.data.slice(0, 120) + "..." : b.data;
            } else {
              small[k] = b[k];
            }
          }
          return small;
        });
      }
      sampleByEntryType[type] = clone;
    }

    // UUID chain analysis
    if ("uuid" in entry) {
      uuidPresentCount++;
      if (entry.uuid === null) uuidNullCount++;
    } else {
      uuidMissingCount++;
    }
    if ("parentUuid" in entry) {
      parentUuidPresentCount++;
      if (entry.parentUuid === null) parentUuidNullCount++;
      if (prevUuid !== null && entry.parentUuid === prevUuid) {
        parentUuidEqualsPrevCount++;
      } else if (entry.parentUuid !== undefined) {
        // Note: includes both null and non-matching values
        if (!(prevUuid !== null && entry.parentUuid === prevUuid)) {
          parentUuidNotEqualPrevCount++;
        }
      }
    } else {
      parentUuidMissingCount++;
    }
    if ("uuid" in entry) {
      prevUuid = entry.uuid;
    }

    // Message-level analysis
    if (entry.message) {
      unionKeys(messageKeys, entry.message);
      const role = entry.message.role;
      const model = entry.message.model;
      addToCount(roleCounts, role);
      addToCount(modelCounts, model);

      if (entry.message.usage) {
        unionKeys(usageKeys, entry.message.usage);
      }
      addToCount(stopReasonCounts, entry.message.stop_reason);
      addToCount(stopSequenceCounts, entry.message.stop_sequence);

      const msgId = entry.message.id;
      if (msgId) {
        const stats = (messageIdOccurrences[msgId] =
          messageIdOccurrences[msgId] || {
            count: 0,
            lastIndex: i,
            lastStopReason: entry.message.stop_reason ?? null,
            rolesSeen: new Set(),
            modelsSeen: new Set(),
          });
        stats.count++;
        stats.lastIndex = i;
        stats.lastStopReason = entry.message.stop_reason ?? null;
        addToSet(stats.rolesSeen, role);
        addToSet(stats.modelsSeen, model);
      }

      // Content blocks
      const content = Array.isArray(entry.message.content) ? entry.message.content : [];
      let hasUserText = false;
      let hasOnlyToolResults = content.length > 0; // will be corrected if text/tool_use appears
      for (const block of content) {
        const bType = block && block.type;
        addToCount(contentBlockTypeCounts, bType);
        if (!contentBlockKeysByType[bType]) contentBlockKeysByType[bType] = new Set();
        unionKeys(contentBlockKeysByType[bType], block);

        if (bType === "text" && role === "user") {
          if (block.text && String(block.text).trim().length > 0) {
            hasUserText = true;
          }
          hasOnlyToolResults = false;
        } else if (bType === "tool_use" && role === "assistant") {
          hasOnlyToolResults = false;
          if (block.id) {
            toolUseIds.add(block.id);
            if (!toolUseIdToAssistantMessageId.has(block.id) && msgId) {
              toolUseIdToAssistantMessageId.set(block.id, msgId);
            }
          }
        } else if (bType === "tool_result" && role === "user") {
          if (block.tool_use_id) {
            toolResultIds.add(block.tool_use_id);
            toolResultIdToUserEntryIndex.set(block.tool_use_id, i);
          }
        } else if (bType === "thinking") {
          hasOnlyToolResults = false;
        } else {
          // other block types
          hasOnlyToolResults = false;
        }
      }

      // Turn detection heuristics
      if (role === "user" && hasUserText) {
        // New turn starts
        if (inTurn && currentTurn) {
          currentTurn.endIndex = i - 1;
          currentTurn.toolUseCount = currentTurnToolUseIds.size;
          currentTurn.toolResultCount = currentTurnToolResultIds.size;
          currentTurn.loopsMatched = Math.min(currentTurn.toolUseCount, currentTurn.toolResultCount);
          perTurn.push(currentTurn);
        }
        inTurn = true;
        turns += 1;
        currentTurn = {
          startIndex: i,
          endIndex: null,
          toolUseCount: 0,
          toolResultCount: 0,
          loopsMatched: 0,
        };
        currentTurnToolUseIds = new Set();
        currentTurnToolResultIds = new Set();
      } else if (inTurn && role === "assistant") {
        // accumulate tool_use ids if present
        for (const block of content) {
          if (block && block.type === "tool_use" && block.id) {
            currentTurnToolUseIds.add(block.id);
          }
        }
        // end on end_turn (or if explicitly signaled)
        if (entry.message.stop_reason === "end_turn") {
          currentTurn.endIndex = i;
          currentTurn.toolUseCount = currentTurnToolUseIds.size;
          currentTurn.toolResultCount = currentTurnToolResultIds.size;
          currentTurn.loopsMatched = Math.min(currentTurn.toolUseCount, currentTurn.toolResultCount);
          perTurn.push(currentTurn);
          inTurn = false;
          currentTurn = null;
        }
      } else if (inTurn && role === "user" && hasOnlyToolResults) {
        // tool_result during the same turn
        for (const block of content) {
          if (block && block.type === "tool_result" && block.tool_use_id) {
            currentTurnToolResultIds.add(block.tool_use_id);
          }
        }
      }
    }
  }

  // Close open turn if any
  if (inTurn && currentTurn) {
    currentTurn.endIndex = entries.length - 1;
    currentTurn.toolUseCount = currentTurnToolUseIds.size;
    currentTurn.toolResultCount = currentTurnToolResultIds.size;
    currentTurn.loopsMatched = Math.min(currentTurn.toolUseCount, currentTurn.toolResultCount);
    perTurn.push(currentTurn);
  }

  // Pairing analysis
  for (const id of toolUseIds) {
    if (!toolResultIds.has(id)) orphanToolUses.add(id);
  }
  for (const id of toolResultIds) {
    if (!toolUseIds.has(id)) orphanToolResults.add(id);
  }

  // Convert Sets to arrays for JSON output
  const rootKeysByTypeObj = {};
  for (const [k, v] of Object.entries(rootKeysByType)) {
    rootKeysByTypeObj[k] = Array.from(v).sort();
  }
  const contentBlockKeysByTypeObj = {};
  for (const [k, v] of Object.entries(contentBlockKeysByType)) {
    contentBlockKeysByTypeObj[k] = Array.from(v).sort();
  }
  const messageIdStats = {};
  for (const [k, v] of Object.entries(messageIdOccurrences)) {
    messageIdStats[k] = {
      count: v.count,
      lastIndex: v.lastIndex,
      lastStopReason: v.lastStopReason,
      rolesSeen: Array.from(v.rolesSeen),
      modelsSeen: Array.from(v.modelsSeen),
    };
  }

  return {
    filePath,
    fileName: path.basename(filePath),
    lineCount,
    versionCounts,
    entryTypeCounts,
    roleCounts,
    modelCounts,
    stopReasonCounts,
    stopSequenceCounts,
    contentBlockTypeCounts,
    toolUseCount: Array.from(toolUseIds).length,
    toolResultCount: Array.from(toolResultIds).length,
    toolUseIds: Array.from(toolUseIds),
    toolResultIds: Array.from(toolResultIds),
    orphanToolUses: Array.from(orphanToolUses),
    orphanToolResults: Array.from(orphanToolResults),
    toolUseIdToAssistantMessageId: Object.fromEntries(toolUseIdToAssistantMessageId),
    messageIdStats,
    uuidChain: {
      uuidPresentCount,
      uuidMissingCount,
      uuidNullCount,
      parentUuidPresentCount,
      parentUuidMissingCount,
      parentUuidNullCount,
      parentUuidEqualsPrevCount,
      parentUuidNotEqualPrevCount,
    },
    turns: {
      count: turns,
      details: perTurn,
    },
    fieldKeys: {
      rootKeysByType: rootKeysByTypeObj,
      messageKeys: Array.from(messageKeys).sort(),
      usageKeys: Array.from(usageKeys).sort(),
      contentBlockKeysByType: contentBlockKeysByTypeObj,
    },
    samples: sampleByEntryType,
  };
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node analyze-sessions-04.js <absPath1.jsonl> ...");
    process.exit(2);
  }
  const results = [];
  for (const f of files) {
    try {
      results.push(summarizeFile(f));
    } catch (e) {
      results.push({ filePath: f, error: String(e) });
    }
  }
  console.log(JSON.stringify({ analyzedAt: new Date().toISOString(), results }, null, 2));
}

if (require.main === module) {
  main();
}


