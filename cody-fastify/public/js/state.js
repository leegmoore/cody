import { normalizeTurnId } from './utils.js';

export const state = {
    currentConversationId: null,
    eventSource: null,
    messageHistory: [],
    currentTurnId: null,
    toolCalls: [],
    toolCallModalCallId: null,
    pendingCompletionId: null,
    toolCallTimelines: new Map(),
    fallbackTurnCounter: 0,
    toolCallSequence: 0,
    API_BASE: 'http://localhost:4010/api/v1',
    TOOL_CARD_STACK_OFFSETS: { x: 8, y: 23 },
    TOOL_CARD_BASE_HEIGHT: 80,
};

export function resolveTurnId(preferred) {
    const normalized = normalizeTurnId(preferred);
    if (normalized) {
        return normalized;
    }
    state.fallbackTurnCounter += 1;
    return `turnless-${state.fallbackTurnCounter}`;
}

export function ensureToolCall(callId, defaults = {}) {
    const id = callId || `tool-${Date.now()}`;
    let existing = state.toolCalls.find((tc) => tc.callId === id);
    const preferredTurnId = normalizeTurnId(defaults.turnId) || state.currentTurnId;

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
            turnId: resolveTurnId(preferredTurnId),
            sequence: ++state.toolCallSequence,
        };
        state.toolCalls.push(existing);
    } else if (!existing.turnId) {
        existing.turnId = resolveTurnId(preferredTurnId);
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