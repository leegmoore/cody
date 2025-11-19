import { state, ensureToolCall, applyToolCallUpdates } from './state.js';
import { 
    updateStatus, addAgentMessage, updateAgentMessage, finalizeAgentMessage, 
    addReasoningMessage, addSystemMessage, 
    syncToolCallUI, delayedToolUpdate, removeThinkingPlaceholder, mapToolStatus
} from './ui.js';
import { normalizeTurnId, formatToolCallJson } from './utils.js';

// Cyclic dependency: stream.js calls loadConversations, which is in app.js
// But app.js calls stream.js (streamTurn).
// To break this, we can pass a callback or use a custom event.
// Or simply attach loadConversations to state/window?
// For now, I'll dispatch a custom event 'turn-complete' on window, and app.js can listen.

export function parseStreamEventData(raw) {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function handleToolCallBeginEvent(data = {}) {
    const targetTurnId = normalizeTurnId(data.turnId) || state.currentTurnId;
    const call = ensureToolCall(data.callId, {
        toolName: data.toolName,
        arguments: data.arguments,
        status: 'in_progress',
        type: 'tool',
        startedAt: Date.now(),
        turnId: targetTurnId,
    });
    applyToolCallUpdates(call, {
        toolName: data.toolName,
        arguments: data.arguments,
        status: 'in_progress',
        type: 'tool',
    });
    syncToolCallUI(call);
}

function handleToolCallEndEvent(data = {}) {
    delayedToolUpdate(data.callId, data.turnId, {
        status: data.status ? mapToolStatus(data.status) : 'completed',
        output: data.output,
        completedAt: Date.now(),
    });
}

function handleExecCommandBeginEvent(data = {}) {
    const targetTurnId = normalizeTurnId(data.turnId) || state.currentTurnId;
    const call = ensureToolCall(data.callId, {
        toolName: data.toolName || 'Command',
        arguments: data.arguments,
        status: 'in_progress',
        type: 'exec',
        startedAt: Date.now(),
        turnId: targetTurnId,
    });
    applyToolCallUpdates(call, {
        toolName: data.toolName || 'Command',
        arguments: data.arguments,
        type: 'exec',
        status: 'in_progress',
    });
    syncToolCallUI(call);
}

function handleExecCommandOutputDeltaEvent(data = {}) {
    if (!data.callId && !data.execId) return;
    const chunk = data.output ?? data.delta ?? data.text ?? '';
    const targetTurnId = normalizeTurnId(data.turnId) || state.currentTurnId;
    const call = ensureToolCall(data.callId || data.execId, {
        toolName: data.toolName || 'Command',
        type: 'exec',
        turnId: targetTurnId,
    });
    applyToolCallUpdates(call, {
        toolName: data.toolName || call.toolName,
        type: 'exec',
    });
    if (chunk) {
        if (call.output == null) {
            call.output = chunk;
        } else if (typeof call.output === 'string' && typeof chunk === 'string') {
            call.output += chunk;
        } else if (typeof chunk === 'string') {
            call.output = `${formatToolCallJson(call.output)}
${chunk}`;
        } else {
            call.output = chunk;
        }
    }
    syncToolCallUI(call);
}

function handleExecCommandEndEvent(data = {}) {
    delayedToolUpdate(data.callId || data.execId, data.turnId, {
        status: data.status ? mapToolStatus(data.status) : 'completed',
        output: data.output,
        completedAt: Date.now(),
    });
}

function handleTsExecBeginEvent(data = {}) {
    const targetTurnId = normalizeTurnId(data.turnId) || state.currentTurnId;
    const call = ensureToolCall(data.execId, {
        toolName: data.label || 'Code Execution',
        arguments: data.source,
        type: 'ts_exec',
        status: 'in_progress',
        startedAt: Date.now(),
        turnId: targetTurnId,
    });
    applyToolCallUpdates(call, {
        toolName: data.label || 'Code Execution',
        arguments: data.source,
        type: 'ts_exec',
        status: 'in_progress',
    });
    syncToolCallUI(call);
}

function handleTsExecEndEvent(data = {}) {
    delayedToolUpdate(data.execId, data.turnId, {
        status: data.status ? mapToolStatus(data.status) : 'completed',
        output: data.output,
        completedAt: Date.now(),
    });
}

export function streamTurn(turnId) {
    // Close existing connection if any
    if (state.eventSource) {
        state.eventSource.close();
    }

    const streamUrl = `${state.API_BASE}/turns/${turnId}/stream-events?thinkingLevel=full&toolLevel=full&toolFormat=full`;
    console.log('Connecting to SSE stream:', streamUrl);
    state.eventSource = new EventSource(streamUrl);

    let currentAgentMessageId = null;
    let agentMessageText = '';

    state.eventSource.addEventListener('task_started', (e) => {
        console.log('Task started:', e.data);
        updateStatus('Processing...', 'yellow');
    });

    state.eventSource.addEventListener('agent_message', (e) => {
        removeThinkingPlaceholder();
        console.log('Agent message event received:', e.data);
        try {
            const data = JSON.parse(e.data);
            
            if (!currentAgentMessageId) {
                currentAgentMessageId = addAgentMessage('');
                agentMessageText = '';
            }
            
            const messageText = data.message || data.text || '';
            agentMessageText += messageText;
            updateAgentMessage(currentAgentMessageId, agentMessageText);
        } catch (error) {
            console.error('Error parsing agent_message:', error, e.data);
        }
    });

    state.eventSource.addEventListener('agent_reasoning', (e) => {
        removeThinkingPlaceholder();
        try {
            const data = JSON.parse(e.data);
            const text = data.text || data.message || data.content || '';
            if (text) {
                addReasoningMessage(text);
            }
        } catch (error) {
            console.error('Error parsing agent_reasoning:', error);
        }
    });

    state.eventSource.addEventListener('tool_call_begin', (e) => {
        removeThinkingPlaceholder();
        handleToolCallBeginEvent(parseStreamEventData(e.data));
    });

    state.eventSource.addEventListener('tool_call_end', (e) => {
        handleToolCallEndEvent(parseStreamEventData(e.data));
    });

    state.eventSource.addEventListener('exec_command_begin', (e) => {
        removeThinkingPlaceholder();
        handleExecCommandBeginEvent(parseStreamEventData(e.data));
    });

    state.eventSource.addEventListener('exec_command_output_delta', (e) => {
        handleExecCommandOutputDeltaEvent(parseStreamEventData(e.data));
    });

    state.eventSource.addEventListener('exec_command_end', (e) => {
        handleExecCommandEndEvent(parseStreamEventData(e.data));
    });

    state.eventSource.addEventListener('ts_exec_begin', (e) => {
        removeThinkingPlaceholder();
        handleTsExecBeginEvent(parseStreamEventData(e.data));
    });

    state.eventSource.addEventListener('ts_exec_end', (e) => {
        handleTsExecEndEvent(parseStreamEventData(e.data));
    });

    state.eventSource.addEventListener('task_complete', (e) => {
        console.log('Task complete:', e.data);
        updateStatus('Connected', 'green');
        const sendButton = document.getElementById('sendButton');
        if (sendButton) sendButton.disabled = false;
        
        if (currentAgentMessageId) {
            finalizeAgentMessage(currentAgentMessageId);
        }
        
        state.eventSource.close();
        state.eventSource = null;
        
        // Notify app to reload conversations
        window.dispatchEvent(new CustomEvent('turn-complete'));
    });

    state.eventSource.addEventListener('turn_aborted', (e) => {
        const data = JSON.parse(e.data);
        console.log('Turn aborted:', data);
        addSystemMessage('Turn was aborted: ' + (data.reason || 'Unknown reason'));
        updateStatus('Connected', 'green');
        const sendButton = document.getElementById('sendButton');
        if (sendButton) sendButton.disabled = false;
        
        state.eventSource.close();
        state.eventSource = null;
        
        window.dispatchEvent(new CustomEvent('turn-complete'));
    });

    state.eventSource.addEventListener('error', (e) => {
        console.error('Stream error:', e);
        updateStatus('Error', 'red');
        const sendButton = document.getElementById('sendButton');
        if (sendButton) sendButton.disabled = false;
        
        if (state.eventSource) {
            state.eventSource.close();
            state.eventSource = null;
        }
    });

    state.eventSource.onerror = (e) => {
        console.error('EventSource error:', e);
        // Check if connection was closed by server (readyState 2)
        if (state.eventSource?.readyState === EventSource.CLOSED) {
            console.log('SSE connection closed by server');
            updateStatus('Connected', 'green');
        } else {
            updateStatus('Connection Error', 'red');
        }
        
        const sendButton = document.getElementById('sendButton');
        if (sendButton) sendButton.disabled = false;
        
        if (state.eventSource) {
            state.eventSource.close();
            state.eventSource = null;
        }
    };
}
