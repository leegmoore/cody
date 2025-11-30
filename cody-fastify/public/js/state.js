import { normalizeRunId } from './utils.js';

export const state = {
    currentThreadId: null,
    currentRunId: null,
    eventSource: null,
    messageHistory: [],
    toolCalls: [],
    toolCallModalCallId: null,
    pendingCompletionId: null,
    toolCallTimelines: new Map(),
    fallbackRunCounter: 0,
    toolCallSequence: 0,
    pendingUserMessages: [],
    renderedItems: new Map(),
    runAgentAnchors: new Map(),
    API_BASE: 'http://localhost:4010/api/v2',
    TOOL_CARD_STACK_OFFSETS: { x: 8, y: 23 },
    TOOL_CARD_BASE_HEIGHT: 80,
};

export function resolveRunId(preferred) {
    const normalized = normalizeRunId(preferred);
    if (normalized) {
        return normalized;
    }
    state.fallbackRunCounter += 1;
    return `runless-${state.fallbackRunCounter}`;
}

export function ensureToolCall(callId, defaults = {}) {
    const id = callId || `tool-${Date.now()}`;
    let existing = state.toolCalls.find((tc) => tc.callId === id);
    const preferredRunId = normalizeRunId(defaults.runId) || state.currentRunId;

    if (!existing) {
        existing = {
            callId: id,
            toolName: defaults.toolName || 'Tool call',
            arguments: defaults.arguments ?? null,
            output: defaults.output ?? null,
            status: defaults.status || 'in_progress',
            type: defaults.type || 'tool',
            startedAt: defaults.startedAt || Date.now(),
            completedAt: defaults.completedAt ?? null,
            runId: resolveRunId(preferredRunId),
            sequence: ++state.toolCallSequence,
        };
        state.toolCalls.push(existing);
    } else if (!existing.runId) {
        existing.runId = resolveRunId(preferredRunId);
    }

    return existing;
}

export function applyToolCallUpdates(call, updates = {}) {
    Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
            call[key] = value;
        }
    });
}
