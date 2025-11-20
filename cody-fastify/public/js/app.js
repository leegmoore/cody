import { state, ensureToolCall, applyToolCallUpdates } from './state.js';
import { 
    updateStatus, addSystemMessage, resetToolCallState, 
    addUserMessage, addAgentMessage, showThinkingPlaceholder, 
    closeToolCallModal, toggleLeftSidebar, toggleRightSidebar,
    syncToolCallUI,
    scrollToBottom,
    addThinkingHistoryMessage
} from './ui.js';
import { streamTurn } from './stream.js';
import { getTimeAgo, escapeHtml } from './utils.js';

// Expose global functions for HTML event handlers
window.toggleLeftSidebar = toggleLeftSidebar;
window.toggleRightSidebar = toggleRightSidebar;
window.closeToolCallModal = closeToolCallModal;

export async function loadConversations() {
    try {
        const response = await fetch(`${state.API_BASE}/conversations`);
        if (!response.ok) {
            console.error('Failed to load conversations');
            return [];
        }
        
        const data = await response.json();
        const conversations = data.conversations || [];
        
        const conversationsList = document.getElementById('conversationsList');
        if (!conversationsList) return conversations;
        
        // Clear existing list (except the "New Chat" button area)
        conversationsList.innerHTML = '';
        
        // Add each conversation
        conversations.forEach(conv => {
            const convDiv = document.createElement('div');
            const isActive = conv.conversationId === state.currentConversationId;
            convDiv.className = `p-3 border-l-4 ${isActive ? 'border-orange-600 bg-orange-50' : 'border-transparent'} hover:border-tan-400 hover:bg-tan-100 cursor-pointer transition-colors`;
            convDiv.onclick = () => switchConversation(conv.conversationId);
            
            let displayTitle = conv.title;
            if (!displayTitle || displayTitle === 'New Conversation') {
                if (conv.firstMessage) {
                    displayTitle = conv.firstMessage;
                } else {
                    displayTitle = conv.title || 'New Conversation';
                }
            }

            const date = new Date(conv.updatedAt || conv.createdAt);
            const timeAgo = getTimeAgo(date);
            const msgCount = conv.messageCount !== undefined ? conv.messageCount : 0;
            const previewText = conv.summary || conv.firstMessage || 'No messages yet';
            
            convDiv.innerHTML = `
                <div class="flex items-start justify-between mb-0.5">
                    <h3 class="font-bold text-brown-900 text-sm truncate flex-1 mr-2" title="${escapeHtml(displayTitle)}">${escapeHtml(displayTitle)}</h3>
                    <span class="text-xs text-brown-500 whitespace-nowrap">${timeAgo}</span>
                </div>
                <p class="text-xs text-brown-600 truncate mb-2" title="${escapeHtml(previewText)}">${escapeHtml(previewText)}</p>
                <div>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-tan-200 text-brown-800">
                        ${msgCount} messages
                    </span>
                </div>
            `;
            
            conversationsList.appendChild(convDiv);
        });
        
        return conversations;
    } catch (error) {
        console.error('Failed to load conversations:', error);
        return [];
    }
}

export async function loadConversationMessages(conversationId) {
    try {
        const response = await fetch(`${state.API_BASE}/conversations/${conversationId}`);
        if (!response.ok) {
            throw new Error('Failed to load conversation');
        }
        
        const data = await response.json();
        const history = data.history || [];
        
        const chatHistory = document.getElementById('chatHistory');
        chatHistory.innerHTML = '';
        
        state.messageHistory = []; // Reset local history
        
        if (history.length === 0) {
            chatHistory.innerHTML = `
                <div class="flex items-center justify-center h-full text-tan-600">
                    <div class="text-center">
                        <p class="text-lg">Start a conversation</p>
                        <p class="text-sm mt-2">Type a message below to begin</p>
                    </div>
                </div>
            `;
            return;
        }
        
        // Render messages
        history.forEach(msg => {
            if (msg.type === 'message' || (!msg.type && msg.role)) {
                if (msg.role === 'user') {
                    addUserMessage(msg.content);
                } else if (msg.role === 'assistant') {
                    addAgentMessage(msg.content);
                }
            } 
            else if (msg.type === 'thinking') {
                addThinkingHistoryMessage(msg.content || '');
            }
            else if (msg.type === 'tool_call') {
                const isExec = msg.toolName === 'exec';
                const call = ensureToolCall(msg.callId, {
                    toolName: msg.toolName,
                    arguments: msg.arguments,
                    status: msg.status || 'in_progress',
                    turnId: msg.turnId,
                    type: isExec ? 'exec' : 'tool'
                });
                applyToolCallUpdates(call, {
                    toolName: msg.toolName,
                    arguments: msg.arguments,
                    status: msg.status || 'in_progress',
                    turnId: msg.turnId
                });
                syncToolCallUI(call);
            }
            else if (msg.type === 'tool_output') {
                const call = ensureToolCall(msg.callId, { turnId: msg.turnId });
                applyToolCallUpdates(call, {
                    output: msg.output,
                    status: 'completed',
                    turnId: msg.turnId
                });
                syncToolCallUI(call);
            }
        });
    } catch (error) {
        console.error('Failed to load conversation messages:', error);
        addSystemMessage('Failed to load conversation. Please try again.');
    }
}

export async function switchConversation(conversationId) {
    if (conversationId === state.currentConversationId) return;
    
    if (state.eventSource) {
        state.eventSource.close();
        state.eventSource = null;
    }
    
    state.currentConversationId = conversationId;
    localStorage.setItem('cody_conversation_id', conversationId);
    resetToolCallState({ flushHistory: true });
    
    const chatHistory = document.getElementById('chatHistory');
    chatHistory.innerHTML = `
        <div class="flex items-center justify-center h-full text-tan-600">
            <div class="text-center">
                <p class="text-lg">Loading conversation...</p>
            </div>
        </div>
    `;
    
    await loadConversationMessages(conversationId);
    loadConversations();
}
window.switchConversation = switchConversation;

export async function createNewConversation() {
    try {
        if (state.eventSource) {
            state.eventSource.close();
            state.eventSource = null;
        }
        
        const response = await fetch(`${state.API_BASE}/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                modelProviderId: 'openai',
                modelProviderApi: 'responses',
                model: 'gpt-5-mini',
                reasoningEffort: 'medium'
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to create conversation: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        state.currentConversationId = data.conversationId;
        resetToolCallState({ flushHistory: true });
        
        const chatHistory = document.getElementById('chatHistory');
        chatHistory.innerHTML = `
            <div class="flex items-center justify-center h-full text-tan-600">
                <div class="text-center">
                    <p class="text-lg">Start a conversation</p>
                    <p class="text-sm mt-2">Type a message below to begin</p>
                </div>
            </div>
        `;
        
        await loadConversations();
        updateStatus('Connected', 'green');
        console.log('New conversation created:', state.currentConversationId);
    } catch (error) {
        console.error('Failed to create new conversation:', error);
        addSystemMessage('Failed to create new conversation. Please try again.');
    }
}
window.createNewConversation = createNewConversation;

export async function sendMessage() {
    const textarea = document.getElementById('messageInput');
    const message = textarea.value.trim();
    
    if (!message || !state.currentConversationId) return;

    textarea.value = '';
    textarea.style.height = 'auto';
    document.getElementById('charCount').textContent = '0 / 4000';

    addUserMessage(message);
    showThinkingPlaceholder();

    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;

    try {
        const response = await fetch(`${state.API_BASE}/conversations/${state.currentConversationId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Send message failed:', response.status, response.statusText, errorText);
            throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        state.currentTurnId = data.turnId;
        resetToolCallState();

        streamTurn(data.turnId);

    } catch (error) {
        console.error('Failed to send message:', error);
        addSystemMessage('Failed to send message. Please try again.');
        sendButton.disabled = false;
    }
}
window.sendMessage = sendMessage;

function setupEventListeners() {
    const textarea = document.getElementById('messageInput');
    
    textarea.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        const newHeight = Math.min(e.target.scrollHeight, 168);
        e.target.style.height = newHeight + 'px';
        
        const charCount = e.target.value.length;
        document.getElementById('charCount').textContent = `${charCount} / 4000`;
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
        const conversations = await loadConversations();
        
        if (conversations && conversations.length > 0) {
            const savedId = localStorage.getItem('cody_conversation_id');
            if (savedId && conversations.some(c => c.conversationId === savedId)) {
                await switchConversation(savedId);
                updateStatus('Connected', 'green');
                return;
            }

            const mostRecent = conversations[0];
            await switchConversation(mostRecent.conversationId);
            updateStatus('Connected', 'green');
            return;
        }
        
        await createNewConversation();
    } catch (error) {
        console.error('Failed to initialize:', error);
        updateStatus('Connection Failed', 'red');
        addSystemMessage('Failed to connect to Cody API. Check console for details.');
    }
}

// Event listener for turn completion to reload list
window.addEventListener('turn-complete', () => {
    loadConversations();
});

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});
