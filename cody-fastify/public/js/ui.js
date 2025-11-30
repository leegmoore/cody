import { state, ensureToolCall, applyToolCallUpdates } from './state.js';
import { 
    escapeHtml, formatToolCallSignature, formatToolCallJson, 
    normalizeRunId 
} from './utils.js';
import { thinkingCards } from './thinking-card.js';

export function scrollToBottom() {
    const chatHistory = document.getElementById('chatHistory');
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

export function clearChatHistory() {
    const chatHistory = document.getElementById('chatHistory');
    if (chatHistory) {
        chatHistory.innerHTML = '';
    }
}

export function setChatPlaceholder(message) {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return;
    chatHistory.innerHTML = `
        <div class="flex items-center justify-center h-full text-tan-600">
            <div class="text-center">
                <p class="text-lg">${escapeHtml(message)}</p>
                <p class="text-sm mt-2">Type a message below to begin</p>
            </div>
        </div>
    `;
}

export function setThreadNavItems(items) {
    const threadNav = document.getElementById('threadNav');
    if (!threadNav) return;
    if (!items.length) {
        threadNav.innerHTML = `
            <div class="text-center text-xs text-brown-500 py-4">
                Conversation breadcrumbs will appear here
            </div>
        `;
        return;
    }
    threadNav.innerHTML = '';
}

export function setActiveThreadTitle(meta = {}) {
    const titleEl = document.getElementById('conversationTitle');
    if (!titleEl) return;
    const displayTitle = meta.title?.trim();
    const fallbackId = meta.threadId ? `Thread ${meta.threadId.slice(0, 8)}` : 'Untitled thread';
    titleEl.textContent = displayTitle && displayTitle.length ? displayTitle : fallbackId;
}

export function setThreadDebugInfo(threadId) {
    const label = document.getElementById('threadDebugLabel');
    const button = document.getElementById('copyThreadIdButton');
    if (!label || !button) return;
    if (threadId) {
        label.textContent = `Thread: ${threadId}`;
        button.disabled = false;
        button.dataset.threadId = threadId;
    } else {
        label.textContent = 'Thread: --';
        button.disabled = true;
        delete button.dataset.threadId;
    }
}

function registerRenderedItem(itemId, elementId) {
    if (!itemId || !elementId) return;
    state.renderedItems.set(itemId, elementId);
    const element = document.getElementById(elementId);
    if (element) {
        element.dataset.itemId = itemId;
    }
}

function getRenderedElement(itemId) {
    const elementId = state.renderedItems.get(itemId);
    if (!elementId) return null;
    return document.getElementById(elementId);
}

export function resetToolCallState(options = {}) {
    const { flushHistory = false } = options;
    if (flushHistory) {
        state.toolCalls = [];
        state.toolCallTimelines.forEach(({ element }) => {
            if (element?.parentNode) {
                element.parentNode.removeChild(element);
            }
        });
        state.toolCallTimelines.clear();
        state.toolCallSequence = 0;
        thinkingCards.clear();
    }
    state.toolCallModalCallId = null;
    closeToolCallModal(true);
}

export function ensureToolTimeline(runId) {
    if (!runId) {
        return null;
    }
    let timeline = state.toolCallTimelines.get(runId);
    if (timeline && document.body.contains(timeline.element)) {
        return timeline;
    }

    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return null;

    const wrapper = document.createElement('div');
    wrapper.className = 'flex justify-start animate-fade-in';
    wrapper.dataset.toolTimelineId = runId;
    wrapper.innerHTML = `
        <div class="tool-call-stack-wrapper">
            <div class="tool-call-cards"></div>
        </div>
    `;

    chatHistory.appendChild(wrapper);
    scrollToBottom();

    const cardsContainer = wrapper.querySelector('.tool-call-cards');
    timeline = { element: wrapper, cardsContainer };
    state.toolCallTimelines.set(runId, timeline);
    return timeline;
}

export function getToolStatusMeta(status) {
    if (status === 'in_progress') {
        return {
            className: 'text-shimmer',
            text: 'Tool Call Processing...', 
            icon: ''
        };
    }
    if (status === 'error') {
        return {
            className: 'text-red-600',
            text: 'Failed',
            icon: `
                <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            `
        };
    }
    return {
        className: 'text-green-700',
        text: 'Completed',
        icon: `
            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
        `
    };
}

export function updateToolCallStack(runId) {
    const normalizedRunId = normalizeRunId(runId);
    if (!normalizedRunId) {
        return;
    }

    const callsForTurn = state.toolCalls
        .filter((call) => call.runId === normalizedRunId)
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

    if (!callsForTurn.length) {
        return;
    }

    const timeline = ensureToolTimeline(normalizedRunId);
    if (!timeline || !timeline.cardsContainer) {
        return;
    }

    timeline.cardsContainer.innerHTML = '';
    timeline.cardsContainer.style.setProperty('--tool-stack-x', `${state.TOOL_CARD_STACK_OFFSETS.x}px`);
    timeline.cardsContainer.style.setProperty('--tool-stack-y', `${state.TOOL_CARD_STACK_OFFSETS.y}px`);

    callsForTurn.forEach((call, index) => {
        const card = document.createElement('div');
        const signature = formatToolCallSignature(call);
        const statusMeta = getToolStatusMeta(call.status);
        const titleColorClass = call.status === 'error' ? 'text-red-700 font-semibold' : 'text-brown-900';
        
        let tooltipHtml = '';
        if (call.status === 'error') {
            tooltipHtml = `<div class="tool-card-tooltip"><span class="text-red-300 font-bold">Failed!</span></div>`;
        } else if (call.status !== 'in_progress') {
            tooltipHtml = `<div class="tool-card-tooltip">Completed</div>`;
        }

        card.className = 'tool-call-card tool-call-card-layered rounded-lg px-3 pt-[5px] pb-2 cursor-pointer';
        card.style.setProperty('--stack-index', index);
        card.style.zIndex = `${index + 1}`;
        card.dataset.callId = call.callId || '';
        card.innerHTML = `
            ${tooltipHtml}
            <div class="w-full">
                <p class="text-xs font-mono ${titleColorClass} truncate w-full" title="${escapeHtml(signature)}">${escapeHtml(signature)}</p>
                <div class="tool-card-status mt-1 flex items-center gap-2 text-[10px] font-semibold ${statusMeta.className}">
                    ${statusMeta.icon}
                    <span>${statusMeta.text}</span>
                </div>
            </div>
        `;

        card.onclick = () => openToolCallModal(call.callId);
        timeline.cardsContainer.appendChild(card);
    });

    const referenceCard = timeline.cardsContainer.querySelector('.tool-call-card-layered');
    if (referenceCard) {
        const rect = referenceCard.getBoundingClientRect();
        const baseHeight = rect?.height || state.TOOL_CARD_BASE_HEIGHT;
        const stackHeight = Math.max(
            baseHeight + (state.TOOL_CARD_STACK_OFFSETS.y * (callsForTurn.length - 1)),
            state.TOOL_CARD_BASE_HEIGHT
        );
        timeline.cardsContainer.style.setProperty('--tool-card-stack-height', `${stackHeight + 4}px`);
    } else {
        timeline.cardsContainer.style.removeProperty('--tool-card-stack-height');
    }

    scrollToBottom();
}

export function renderToolCallModalContent(call) {
    if (!call) return; 
    
    const signature = formatToolCallSignature(call);
    document.getElementById('modalToolName').textContent = signature;
    
    const formatJsonContent = (value) => {
        if (value === undefined || value === null) return 'No content';

        const unwrap = (item) => {
            if (typeof item === 'string') {
                const trimmed = item.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                    try {
                        return unwrap(JSON.parse(item));
                    } catch {
                        return item;
                    }
                }
                return item;
            }
            if (Array.isArray(item)) {
                return item.map(unwrap);
            }
            if (item !== null && typeof item === 'object') {
                const copy = {};
                for (const key in item) {
                    copy[key] = unwrap(item[key]);
                }
                return copy;
            }
            return item;
        };

        try {
            const unwrapped = unwrap(value);
            if (typeof unwrapped === 'object') {
                let str = JSON.stringify(unwrapped, null, 2);
                str = str.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
                return str;
            }
            return String(unwrapped);
        } catch (e) {
            return String(value);
        }
    };

    const highlightJson = (content) => {
        try {
            if (window.hljs) {
                return window.hljs.highlight(content, { language: 'json' }).value;
            }
            return escapeHtml(content);
        } catch (e) {
            console.warn('Highlight error:', e);
            return escapeHtml(content);
        }
    };

    const argsContent = formatJsonContent(call.arguments || (call.arguments === 0 ? 0 : null));
    const argsEl = document.getElementById('modalToolArgs');
    argsEl.innerHTML = highlightJson(argsContent);
    argsEl.classList.add('hljs', 'language-json');
    
    let outputContent;
    if (call.output !== undefined && call.output !== null) {
        outputContent = formatJsonContent(call.output);
    } else {
        outputContent = call.status === 'in_progress' ? 'Waiting for output...' : 'Tool did not return output.';
    }
    
    const outputEl = document.getElementById('modalToolOutput');
    outputEl.innerHTML = highlightJson(outputContent);
    outputEl.classList.add('hljs', 'language-json');

    const siblings = state.toolCalls
        .filter(tc => tc.runId === call.runId)
        .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
    
    const currentIndex = siblings.findIndex(tc => tc.callId === call.callId);
    const prevButton = document.getElementById('modalPrevButton');
    const nextButton = document.getElementById('modalNextButton');

    if (siblings.length > 1 && currentIndex !== -1) {
        if (currentIndex > 0) {
            prevButton.disabled = false;
            prevButton.onclick = () => {
                const prevCall = siblings[currentIndex - 1];
                state.toolCallModalCallId = prevCall.callId;
                renderToolCallModalContent(prevCall);
            };
        } else {
            prevButton.disabled = true;
            prevButton.onclick = null;
        }

        if (currentIndex < siblings.length - 1) {
            nextButton.disabled = false;
            nextButton.onclick = () => {
                const nextCall = siblings[currentIndex + 1];
                state.toolCallModalCallId = nextCall.callId;
                renderToolCallModalContent(nextCall);
            };
        } else {
            nextButton.disabled = true;
            nextButton.onclick = null;
        }
    } else {
        prevButton.disabled = true;
        nextButton.disabled = true;
    }
}

export function openToolCallModal(callId) {
    const modal = document.getElementById('toolCallModal');
    const call = state.toolCalls.find((tc) => tc.callId === callId) || state.toolCalls[state.toolCalls.length - 1];
    if (!modal || !call) return; 
    
    state.toolCallModalCallId = call.callId;
    renderToolCallModalContent(call);
    
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

export function closeToolCallModal(silent = false) {
    const modal = document.getElementById('toolCallModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (!silent) {
        state.toolCallModalCallId = null;
    }
}

export function syncToolCallUI(call) {
    if (call) {
        updateToolCallStack(call.runId);
    }
    if (state.toolCallModalCallId) {
        const active = state.toolCalls.find(tc => tc.callId === state.toolCallModalCallId);
        if (active) {
            renderToolCallModalContent(active);
        } else {
            state.toolCallModalCallId = null;
            closeToolCallModal(true);
        }
    }
}

export function mapToolStatus(status) {
    if (!status) return 'completed';
    if (status === 'failed' || status === 'error') return 'error';
    return 'completed';
}


export function showThinkingPlaceholder() {
    const chatHistory = document.getElementById('chatHistory');
    if (document.getElementById('temp-thinking-placeholder')) return;

    const thinkingPlaceholder = document.createElement('div');
    thinkingPlaceholder.id = 'temp-thinking-placeholder';
    thinkingPlaceholder.className = 'flex justify-start mt-1 mb-2 animate-fade-in';
    thinkingPlaceholder.innerHTML = `
        <div class="status-shimmer ml-2">Doing AI Stuff...</div>
    `;
    chatHistory.appendChild(thinkingPlaceholder);
    scrollToBottom();
}

export function removeThinkingPlaceholder() {
    state.pendingCompletionId = null;
    const placeholder = document.getElementById('temp-thinking-placeholder');
    if (placeholder) {
        placeholder.remove();
    }
}

export function delayedToolUpdate(callId, runId, updates) {
    state.pendingCompletionId = callId;
    setTimeout(() => {
        const targetRunId = normalizeRunId(runId) || state.currentRunId;
        const call = ensureToolCall(callId, { type: 'tool', runId: targetRunId });
        applyToolCallUpdates(call, updates);
        syncToolCallUI(call);
        
        if (state.pendingCompletionId === callId) {
            setTimeout(() => {
                if (state.pendingCompletionId === callId) {
                    showThinkingPlaceholder();
                    state.pendingCompletionId = null;
                }
            }, 1100);
        }
    }, 800);
}

export function addUserMessage(text, options = {}) {
    const chatHistory = document.getElementById('chatHistory');
    const emptyState = chatHistory.querySelector('.flex.items-center.justify-center');
    if (emptyState && emptyState.textContent.includes('Start a conversation')) {
        emptyState.remove();
    }

    const messageId = options.itemId || `user-${Date.now()}`;
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex justify-end animate-fade-in';
    messageDiv.dataset.itemId = messageId;
    messageDiv.dataset.origin = 'user';
    messageDiv.innerHTML = `
        <div class="max-w-3xl">
            <div class="bg-orange-600 text-white rounded-lg px-4 py-3 shadow">
                <div class="message-content">${escapeHtml(text)}</div>
            </div>
        </div>
    `;
    
    chatHistory.appendChild(messageDiv);
    scrollToBottom();
    
    addToThreadNav('user', text);
    state.messageHistory.push({ role: 'user', content: text, element: messageDiv, id: messageId });
    return messageId;
}

export function addAgentMessage(text, options = {}) {
    const chatHistory = document.getElementById('chatHistory');
    const emptyState = chatHistory.querySelector('.flex.items-center.justify-center');
    if (emptyState && emptyState.textContent.includes('Start a conversation')) {
        emptyState.remove();
    }

    const messageId = options.itemId || `agent-${Date.now()}`;
    
    const messageDiv = document.createElement('div');
    messageDiv.id = messageId;
    messageDiv.dataset.origin = 'agent';
    messageDiv.className = 'flex justify-start animate-fade-in';
    messageDiv.dataset.itemId = messageId;
    messageDiv.innerHTML = `
        <div class="max-w-3xl">
            <div class="bg-white border-2 border-tan-300 rounded-lg px-4 py-3 shadow">
                <div class="flex items-center mb-2">
                    <div class="w-6 h-6 bg-orange-600 rounded flex items-center justify-center text-white text-xs font-bold mr-2">C</div>
                    <span class="text-sm font-semibold text-brown-800">Cody</span>
                </div>
                <div class="message-content text-brown-900">${escapeHtml(text)}</div>
            </div>
        </div>
    `;
    
    chatHistory.appendChild(messageDiv);
    scrollToBottom();
    
    state.messageHistory.push({ role: 'assistant', content: text, element: messageDiv, id: messageId });
    return messageId;
}

export function updateAgentMessage(messageId, text) {
    const messageDiv = document.getElementById(messageId);
    if (!messageDiv) {
        return;
    }
    const contentDiv = messageDiv.querySelector('.message-content');
    if (!contentDiv) {
        return;
    }
    contentDiv.textContent = text;
    scrollToBottom();
}

export function finalizeAgentMessage(messageId) {
    const messageDiv = document.getElementById(messageId);
    if (messageDiv) {
        const text = messageDiv.querySelector('.message-content').textContent;
        addToThreadNav('assistant', text);
    }
}

export function addReasoningMessage(text) {
    const chatHistory = document.getElementById('chatHistory');
    
    const lastMessage = chatHistory.lastElementChild;
    if (lastMessage && lastMessage.classList.contains('reasoning-message')) {
        const contentDiv = lastMessage.querySelector('.reasoning-content');
        if (contentDiv) {
            contentDiv.textContent += text;
            scrollToBottom();
            return;
        }
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex justify-start reasoning-message animate-fade-in';
    messageDiv.innerHTML = `
        <div class="max-w-3xl w-full">
            <div class="bg-tan-200 border-l-4 border-tan-400 rounded-r-lg px-4 py-3 shadow-sm my-2">
                <div class="flex items-center mb-1">
                    <svg class="w-4 h-4 mr-2 text-tan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    <span class="text-xs font-bold uppercase tracking-wide text-tan-700">Reasoning</span>
                </div>
                <div class="reasoning-content text-sm text-brown-800 font-mono whitespace-pre-wrap">${escapeHtml(text)}</div>
            </div>
        </div>
    `;
    
    chatHistory.appendChild(messageDiv);
    scrollToBottom();
}

export function addThinkingHistoryMessage(text) {
    const chatHistory = document.getElementById('chatHistory');
    const wrapper = document.createElement('div');
    wrapper.className = 'flex justify-start thinking-message animate-fade-in';

    wrapper.innerHTML = `
        <div class="thinking-card completed" data-history="true">
            <div class="thinking-card-header">
                <div class="thinking-card-title">
                    <svg class="w-4 h-4 mr-1 text-orange-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path>
                    </svg>
                    <span class="text-xs font-semibold tracking-wide uppercase text-brown-700">Thinking</span>
                </div>
                <span class="thinking-status text-xs font-semibold text-brown-700">Finished</span>
            </div>
            <div class="thinking-content text-sm text-brown-900 font-mono whitespace-pre-wrap" data-expanded="false"></div>
            <div class="thinking-card-footer">
                <span class="thinking-hint text-[11px] font-semibold text-brown-600">Click to expand</span>
                <svg class="thinking-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6"></path>
                </svg>
            </div>
        </div>
    `;

    const content = wrapper.querySelector('.thinking-content');
    if (content) {
        content.textContent = text;
    }
    // Note: This function uses legacy CSS classes that were removed
    // Expand/collapse functionality removed - consider migrating to ThinkingCard system
    chatHistory.appendChild(wrapper);
    scrollToBottom();
}

export function addSystemMessage(text) {
    const chatHistory = document.getElementById('chatHistory');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex justify-center animate-fade-in';
    messageDiv.innerHTML = `
        <div class="max-w-2xl">
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg text-sm">
                ${escapeHtml(text)}
            </div>
        </div>
    `;
    chatHistory.appendChild(messageDiv);
    scrollToBottom();
}

export function addToThreadNav(role, content) {
    const threadNav = document.getElementById('threadNav');
    if (!threadNav) return; 
    
    if (threadNav.querySelector('.text-center')) {
        threadNav.innerHTML = '';
    }
    
    const preview = content.substring(0, 50) + (content.length > 50 ? '...' : '');
    const icon = role === 'user' ? '👤' : '🤖';
    const bgColor = role === 'user' ? 'bg-orange-100 hover:bg-orange-200' : 'bg-tan-200 hover:bg-tan-300';
    
    const navItem = document.createElement('div');
    navItem.className = `nav-item ${bgColor} rounded-lg p-2 mb-2 cursor-pointer transition-colors`;
    navItem.innerHTML = `
        <div class="flex items-start">
            <span class="mr-2 text-sm">${icon}</span>
            <div class="flex-1 min-w-0">
                <div class="text-xs text-brown-600 font-medium mb-1">${role === 'user' ? 'You' : 'Cody'}</div>
                <div class="text-xs text-brown-700 truncate">${escapeHtml(preview)}</div>
            </div>
        </div>
    `;
    
    navItem.onclick = () => {
        const messageElements = state.messageHistory.filter(m => m.role === role && m.content.startsWith(content.substring(0, 30)));
        if (messageElements.length > 0) {
            messageElements[messageElements.length - 1].element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    };
    
    threadNav.appendChild(navItem);
}

export function updateStatus(text, color) {
    const statusIndicator = document.getElementById('statusIndicator');
    const colors = {
        'green': 'bg-green-500',
        'yellow': 'bg-yellow-500',
        'red': 'bg-red-500'
    };
    
    statusIndicator.innerHTML = `
        <span class="inline-block w-2 h-2 ${colors[color]} rounded-full mr-1"></span>
        ${text}
    `;
}

export function toggleLeftSidebar() {
    const sidebar = document.getElementById('leftSidebar');
    const toggle = document.getElementById('leftSidebarToggle');
    
    if (sidebar.classList.contains('-ml-64')) {
        sidebar.classList.remove('-ml-64');
        toggle.classList.add('hidden');
    } else {
        sidebar.classList.add('-ml-64');
        toggle.classList.remove('hidden');
    }
}

export function toggleRightSidebar() {
    const sidebar = document.getElementById('rightSidebar');
    const toggle = document.getElementById('rightSidebarToggle');
    
    if (sidebar.classList.contains('-mr-64')) {
        sidebar.classList.remove('-mr-64');
        toggle.classList.add('hidden');
    } else {
        sidebar.classList.add('-mr-64');
        toggle.classList.remove('hidden');
    }
}

export function renderResponseItems(items = [], context = {}) {
    items.forEach((item) => {
        // Skip if already rendered (prevent duplicate renders)
        // Check by looking for the element in the DOM with matching data-item-id
        const existing = getRenderedElement(item.id);
        if (existing) {
            // Item is already rendered - just update content if needed
            if (item.type === 'message') {
                const content = existing.querySelector('.message-content');
                if (content && content.textContent !== item.content) {
                    content.textContent = item.content;
                }
            }
            // Skip rendering - already exists
            return;
        }
        
        switch (item.type) {
            case 'message':
                renderMessageItem(item, context);
                break;
            case 'reasoning':
                // Only create thinking cards from persisted data (when loading thread history)
                // During live streaming, handleThinkingEvent in stream.js manages cards
                // Check if this is from persistence (no live streaming context)
                const isFromPersistence = context.status === 'complete' || !state.eventSource;
                if (isFromPersistence) {
                    // Create card from persisted reasoning item
                    thinkingCards.create(item.id, context.runId);
                    const card = thinkingCards.get(item.id);
                    if (card && item.content) {
                        // Set the complete content (it's already complete when loading from persistence)
                        card.content = item.content;
                        if (card.contentEl) {
                            card.contentEl.textContent = item.content;
                        }
                        card.complete();
                    }
                }
                // During live streaming, ignore reasoning items here - handleThinkingEvent handles them
                break;
            case 'function_call':
                renderFunctionCallItem(item, context);
                break;
            case 'function_call_output':
                renderFunctionCallOutput(item, context);
                break;
            case 'error':
                renderErrorCard(item, context);
                break;
            case 'cancelled':
                renderCancelledCard(item, context);
                break;
            default:
                break;
        }
    });

    if (context?.runId && ['complete', 'error', 'aborted'].includes(context.status)) {
        state.runAgentAnchors.delete(context.runId);
    }
}

function updateMessageContent(elementId, text) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const content = el.querySelector('.message-content');
    if (content) {
        content.textContent = text;
    }
}

function renderMessageItem(item, context) {
    const origin = item.origin || 'agent';
    
    // Skip rendering user messages that haven't been finalized yet (they'll have "agent" origin temporarily)
    // User messages have IDs like "${runId}-user-prompt"
    if (origin === 'agent' && item.id && item.id.includes('-user-prompt')) {
        return;
    }
    
    if (origin === 'agent' && (!item.content || item.content.length === 0)) {
        return;
    }
    const existing = getRenderedElement(item.id);
    const runId = context?.runId;
    const anchor = runId ? state.runAgentAnchors.get(runId) : null;
    if (anchor && anchor.itemId !== item.id) {
        state.runAgentAnchors.delete(runId);
    }
    if (existing) {
        // Check if origin changed - if so, we need to re-render
        const existingOrigin = existing.dataset.origin || 'agent';
        if (existingOrigin !== origin) {
            // Origin changed - remove old element and re-render
            existing.remove();
            // Clear from rendered items map
            state.renderedItems.delete(item.id);
        } else {
            // Same origin - just update content
            const content = existing.querySelector('.message-content');
            if (content && content.textContent !== item.content) {
                content.textContent = item.content;
                scrollToBottom();
            }
            if (origin === 'agent' && runId) {
                state.runAgentAnchors.set(runId, {
                    itemId: item.id,
                    elementId: existing.id,
                });
            }
            return;
        }
    }

    if (origin === 'user') {
        // Check if this item is already rendered
        if (existing) {
            // Already rendered - just update content if needed
            const content = existing.querySelector('.message-content');
            if (content && content.textContent !== item.content) {
                content.textContent = item.content;
            }
            return;
        }
        
        // Check if there's a pending user message for this run
        // Match by runId - the pending message should have been updated with the runId when the stream started
        const pendingIndex = state.pendingUserMessages.findIndex(
            (entry) => entry.runId === context.runId,
        );
        if (pendingIndex >= 0) {
            const pending = state.pendingUserMessages.splice(pendingIndex, 1)[0];
            // Update the element's data-item-id to match the stream item ID
            const element = document.getElementById(pending.elementId);
            if (element) {
                // Remove old itemId from renderedItems if it was registered
                const oldItemId = element.dataset.itemId;
                if (oldItemId && state.renderedItems.has(oldItemId)) {
                    state.renderedItems.delete(oldItemId);
                }
                // Update to new item ID
                element.dataset.itemId = item.id;
            }
            registerRenderedItem(item.id, pending.elementId);
            updateMessageContent(pending.elementId, item.content);
            return;
        }
        
        // No pending message - create new one (this happens when loading from persistence)
        const elementId = addUserMessage(item.content, { itemId: item.id });
        registerRenderedItem(item.id, elementId);
        return;
    }

    if (anchor && runId) {
        registerRenderedItem(item.id, anchor.elementId);
        updateMessageContent(anchor.elementId, item.content);
        state.runAgentAnchors.set(runId, {
            itemId: item.id,
            elementId: anchor.elementId,
        });
        return;
    }

    const elementId = addAgentMessage(item.content || '', { itemId: item.id });
    registerRenderedItem(item.id, elementId);
    if (runId) {
        state.runAgentAnchors.set(runId, {
            itemId: item.id,
            elementId,
        });
    }
}


function renderFunctionCallItem(item, context) {
    const args = safeJson(item.arguments);
    const existing = state.toolCalls.find((tc) => tc.callId === item.call_id);
    const call = ensureToolCall(item.call_id, {
        toolName: item.name,
        arguments: args,
        status: existing?.status ?? 'in_progress',
        runId: context.runId,
        type: item.name === 'exec' ? 'exec' : 'tool'
    });
    const updates = {
        toolName: item.name,
        arguments: args,
        runId: context.runId,
    };
    if (!existing) {
        updates.status = 'in_progress';
        updates.startedAt = Date.now();
    }
    applyToolCallUpdates(call, updates);
    syncToolCallUI(call);
}

function renderFunctionCallOutput(item, context) {
    const call = ensureToolCall(item.call_id, { runId: context.runId });
    if (call.status === 'completed' || call.status === 'error') {
        return;
    }
    delayedToolUpdate(item.call_id, context.runId, {
        output: safeJson(item.output),
        status: item.success ? 'completed' : 'error',
        completedAt: Date.now(),
    });
}

function renderErrorCard(item, context) {
    const existing = getRenderedElement(item.id);
    if (existing) return;
    const chatHistory = document.getElementById('chatHistory');
    const wrapper = document.createElement('div');
    wrapper.className = 'flex justify-center animate-fade-in';
    const elementId = `error-${item.id}`;
    wrapper.id = elementId;
    wrapper.innerHTML = `
        <div class="max-w-2xl">
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-lg text-sm">
                <strong>Error:</strong> ${escapeHtml(item.message)}
            </div>
        </div>
    `;
    chatHistory.appendChild(wrapper);
    registerRenderedItem(item.id, elementId);
    scrollToBottom();
}

function renderCancelledCard(item) {
    const existing = getRenderedElement(item.id);
    if (existing) return;
    const chatHistory = document.getElementById('chatHistory');
    const wrapper = document.createElement('div');
    wrapper.className = 'flex justify-center animate-fade-in';
    const elementId = `cancelled-${item.id}`;
    wrapper.id = elementId;
    wrapper.innerHTML = `
        <div class="max-w-2xl">
            <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded-lg text-sm">
                <strong>Cancelled:</strong> ${escapeHtml(item.reason || 'Run was cancelled.')}
            </div>
        </div>
    `;
    chatHistory.appendChild(wrapper);
    registerRenderedItem(item.id, elementId);
    scrollToBottom();
}

function safeJson(value) {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

export function scrollToMessage(messageId) {
    const element = document.querySelector(`[data-message-id="${messageId}"]`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('ring-2', 'ring-orange-500', 'ring-opacity-50');
        setTimeout(() => {
            element.classList.remove('ring-2', 'ring-orange-500', 'ring-opacity-50');
        }, 1000);
    }
}
