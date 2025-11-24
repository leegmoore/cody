import { state } from './state.js';
import {
    updateStatus,
    addSystemMessage,
    resetToolCallState,
    addUserMessage,
    showThinkingPlaceholder,
    closeToolCallModal,
    toggleLeftSidebar,
    toggleRightSidebar,
    renderResponseItems,
    clearChatHistory,
    setChatPlaceholder,
    setThreadNavItems,
    setActiveThreadTitle,
    setThreadDebugInfo
} from './ui.js';
import { streamRun } from './stream.js';
import { getTimeAgo, escapeHtml } from './utils.js';

const THREAD_STORAGE_KEY = 'cody_thread_id';
setThreadDebugInfo(null);

window.toggleLeftSidebar = toggleLeftSidebar;
window.toggleRightSidebar = toggleRightSidebar;
window.closeToolCallModal = closeToolCallModal;
window.sendMessage = sendMessage;
window.createNewConversation = createNewThread;
window.switchConversation = switchThread;
window.copyThreadId = copyThreadId;

async function loadThreads() {
    try {
        const response = await fetch(`${state.API_BASE}/threads`);
        if (!response.ok) {
            throw new Error('Failed to load threads');
        }
        const data = await response.json();
        const threads = data.threads || [];
        renderThreadList(threads);
        return threads;
    } catch (error) {
        console.error('Failed to load threads:', error);
        addSystemMessage('Unable to load threads. Please try again.');
        return [];
    }
}

function renderThreadList(threads) {
    const listEl = document.getElementById('conversationsList');
    if (!listEl) return;

    if (!threads.length) {
        listEl.innerHTML = `
            <div class="flex items-center justify-center h-full text-tan-600">
                <div class="text-center text-sm">No threads yet. Start a new chat!</div>
            </div>
        `;
        return;
    }

    listEl.innerHTML = '';
    threads.forEach((thread) => {
        const item = document.createElement('div');
        const isActive = thread.threadId === state.currentThreadId;
        item.className = `p-3 border-l-4 ${isActive ? 'border-orange-600 bg-orange-50' : 'border-transparent'} hover:border-tan-400 hover:bg-tan-100 cursor-pointer transition-colors`;
        item.onclick = () => switchThread(thread.threadId);

        const title = thread.title?.trim() || `Thread ${thread.threadId.slice(0, 8)}`;
        const preview = thread.summary?.trim() || `ID: ${thread.threadId}`;
        const updatedAt = new Date(thread.updatedAt);
        const timeAgo = getTimeAgo(updatedAt);

        item.innerHTML = `
            <div class="flex items-start justify-between mb-0.5">
                <h3 class="font-bold text-brown-900 text-sm truncate flex-1 mr-2" title="${escapeHtml(title)}">${escapeHtml(title)}</h3>
                <span class="text-xs text-brown-500 whitespace-nowrap">${timeAgo}</span>
            </div>
            <p class="text-xs text-brown-600 truncate mb-2" title="${escapeHtml(preview)}">${escapeHtml(preview)}</p>
            <div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-tan-200 text-brown-800">${thread.tags?.length || 0} tags</span>
            </div>
        `;

        listEl.appendChild(item);
    });
}

async function switchThread(threadId) {
    if (state.eventSource) {
        state.eventSource.close();
        state.eventSource = null;
    }

    state.currentThreadId = threadId;
    state.currentRunId = null;
    state.renderedItems.clear();
    state.runAgentAnchors.clear();
    state.pendingUserMessages = [];
    resetToolCallState({ flushHistory: true });
    localStorage.setItem(THREAD_STORAGE_KEY, threadId);
    resetChatSurface('Loading thread history...');

    await loadThread(threadId);
    await loadThreads();
}

async function loadThread(threadId) {
    try {
        const response = await fetch(`${state.API_BASE}/threads/${threadId}`);
        if (!response.ok) {
            throw new Error('Failed to load thread');
        }
        const data = await response.json();
        const runs = data.runs || [];
        const threadMeta = data.thread || { threadId, title: null };

        clearChatHistory();
        setThreadNavItems([]);
        setActiveThreadTitle(threadMeta);
        setThreadDebugInfo(threadMeta.threadId);

        runs.forEach((run) => {
            renderResponseItems(run.output_items || [], {
                threadId,
                runId: run.id,
                status: run.status,
                createdAt: run.created_at,
            });
        });

        if (!runs.length) {
            setChatPlaceholder('Start a conversation');
        }
    } catch (error) {
        console.error('Failed to load thread:', error);
        addSystemMessage('Failed to load thread. Please try again.');
    }
}

function resetChatSurface(message) {
    const chatHistory = document.getElementById('chatHistory');
    if (!chatHistory) return;
    chatHistory.innerHTML = `
        <div class="flex items-center justify-center h-full text-tan-600">
            <div class="text-center">
                <p class="text-lg">${escapeHtml(message)}</p>
            </div>
        </div>
    `;
}

async function createNewThread() {
    try {
        const response = await fetch(`${state.API_BASE}/threads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                modelProviderId: 'openai',
                modelProviderApi: 'responses',
                model: 'gpt-5-mini',
                title: 'New Chat'
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || 'Unknown error');
        }

        const data = await response.json();
        await switchThread(data.threadId);
        updateStatus('Connected', 'green');
    } catch (error) {
        console.error('Failed to create thread:', error);
        addSystemMessage('Failed to create new thread.');
    }
}

async function sendMessage() {
    const textarea = document.getElementById('messageInput');
    const message = textarea.value.trim();

    if (!message || !state.currentThreadId) return;

    textarea.value = '';
    textarea.style.height = 'auto';
    document.getElementById('charCount').textContent = '0 / 4000';

    const userElementId = addUserMessage(message);
    state.pendingUserMessages.push({ runId: null, elementId: userElementId });
    showThinkingPlaceholder();

    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;

    try {
        const response = await fetch(`${state.API_BASE}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                threadId: state.currentThreadId,
                prompt: message,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Failed to send message');
        }

        const { runId } = await response.json();
        state.currentRunId = runId;
        const pending = state.pendingUserMessages[state.pendingUserMessages.length - 1];
        if (pending) {
            pending.runId = runId;
        }
        resetToolCallState();
        streamRun(runId, { threadId: state.currentThreadId });
    } catch (error) {
        console.error('Failed to send message:', error);
        addSystemMessage('Failed to send message.');
        sendButton.disabled = false;
    }
}

function bindComposer() {
    const textarea = document.getElementById('messageInput');
    textarea.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        const newHeight = Math.min(e.target.scrollHeight, 168);
        e.target.style.height = `${newHeight}px`;
        document.getElementById('charCount').textContent = `${e.target.value.length} / 4000`;
    });

    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeToolCallModal();
        }
    });
}

async function initializeApp() {
    try {
        const threads = await loadThreads();
        if (threads.length === 0) {
            await createNewThread();
            return;
        }

        const savedId = localStorage.getItem(THREAD_STORAGE_KEY);
        const initial = threads.find((t) => t.threadId === savedId) || threads[0];
        await switchThread(initial.threadId);
        updateStatus('Connected', 'green');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        updateStatus('Connection Failed', 'red');
        addSystemMessage('Failed to initialize UI.');
    }
}

window.addEventListener('run-complete', () => {
    void loadThreads();
});

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    bindComposer();
});

function copyThreadId() {
    const button = document.getElementById('copyThreadIdButton');
    const threadId = button?.dataset.threadId || state.currentThreadId;
    if (!threadId || !navigator.clipboard) {
        return;
    }
    navigator.clipboard.writeText(threadId).then(() => {
        button.textContent = 'Copied!';
        setTimeout(() => {
            button.textContent = 'Copy ID';
        }, 1500);
    }).catch(() => {
        button.textContent = 'Failed';
        setTimeout(() => {
            button.textContent = 'Copy ID';
        }, 1500);
    });
}
