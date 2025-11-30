/**
 * ThinkingCard - A single thinking/reasoning display card
 */
export class ThinkingCard {
    constructor(id, runId) {
        this.id = id;
        this.runId = runId;
        this.content = '';
        this.element = null;
        this.contentEl = null;
        this.statusEl = null;
        this.isCompleted = false;
        this.isExpanded = false;
    }

    create() {
        const chatHistory = document.getElementById('chatHistory');
        if (!chatHistory) return null;

        this.element = this._buildDOM();
        this._insertAtPosition(chatHistory);
        this._bindEvents();
        this._scrollChatToBottom();

        return this;
    }

    append(text) {
        if (!text || this.isCompleted) return;

        this.content += text;
        if (this.contentEl) {
            this.contentEl.textContent = this.content;
            this._autoScrollContent();
        }
    }

    complete(finalText) {
        // Only use finalText if we don't have any content yet (backwards compatibility)
        // Otherwise, the content was already streamed via append()
        if (finalText !== undefined && this.content === '') {
            this.content = finalText;
            if (this.contentEl) {
                this.contentEl.textContent = this.content;
            }
        }

        this.isCompleted = true;

        if (this.element) {
            const card = this.element.querySelector('.tc-card');
            if (card) {
                card.classList.remove('tc-streaming');
                card.classList.add('tc-completed');
            }
        }

        // Always update status, even if we need to re-find the element
        if (!this.statusEl && this.element) {
            this.statusEl = this.element.querySelector('.tc-status');
        }
        if (this.statusEl) {
            this.statusEl.textContent = 'Finished';
            this.statusEl.classList.remove('tc-shimmer');
        }
    }

    toggle() {
        if (!this.isCompleted) return;

        this.isExpanded = !this.isExpanded;
        const card = this.element?.querySelector('.tc-card');

        if (this.isExpanded) {
            card?.classList.add('tc-expanded');
        } else {
            card?.classList.remove('tc-expanded');
        }
    }

    /**
     * Remove the DOM element from the page
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.contentEl = null;
        this.statusEl = null;
    }

    _buildDOM() {
        const wrapper = document.createElement('div');
        wrapper.className = 'tc-wrapper';
        wrapper.dataset.thinkingId = this.id;
        if (this.runId) {
            wrapper.dataset.runId = this.runId;
        }

        wrapper.innerHTML = `
            <div class="tc-card tc-streaming">
                <div class="tc-header">
                    <div class="tc-title">
                        <svg class="tc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
                                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                        <span class="tc-label">Thinking</span>
                    </div>
                    <span class="tc-status tc-shimmer">Thinking...</span>
                </div>
                <div class="tc-content"></div>
                <div class="tc-footer">
                    <span class="tc-hint">Click to expand</span>
                    <svg class="tc-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 9l6 6 6-6"/>
                    </svg>
                </div>
            </div>
        `;

        this.contentEl = wrapper.querySelector('.tc-content');
        this.statusEl = wrapper.querySelector('.tc-status');

        return wrapper;
    }

    _insertAtPosition(chatHistory) {
        // Priority 1: Insert before tool timeline for this run
        if (this.runId) {
            const toolTimeline = chatHistory.querySelector(
                `[data-tool-timeline-id="${this.runId}"]`
            );
            if (toolTimeline) {
                chatHistory.insertBefore(this.element, toolTimeline);
                return;
            }
        }

        // Priority 2: Insert after the last user message
        // User messages have class "flex justify-end" AND a data-item-id attribute
        const userMessages = chatHistory.querySelectorAll('.flex.justify-end[data-item-id]');
        if (userMessages.length > 0) {
            const lastUserMessage = userMessages[userMessages.length - 1];
            const nextSibling = lastUserMessage.nextSibling;
            if (nextSibling) {
                chatHistory.insertBefore(this.element, nextSibling);
            } else {
                chatHistory.appendChild(this.element);
            }
            return;
        }

        // Fallback: Append to end
        chatHistory.appendChild(this.element);
    }

    _bindEvents() {
        const card = this.element?.querySelector('.tc-card');
        card?.addEventListener('click', () => {
            const selection = window.getSelection();
            if (selection && selection.toString().length > 0) return;
            this.toggle();
        });
    }

    _autoScrollContent() {
        // Keep thinking content scrolled to bottom during streaming
        if (!this.contentEl || this.isCompleted) return;
        this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }

    _scrollChatToBottom() {
        const chatHistory = document.getElementById('chatHistory');
        if (chatHistory) {
            chatHistory.scrollTop = chatHistory.scrollHeight;
        }
    }
}

/**
 * ThinkingCardManager - Manages all thinking cards for a session
 */
export class ThinkingCardManager {
    constructor() {
        this.cards = new Map();
    }

    create(id, runId) {
        if (this.cards.has(id)) {
            return this.cards.get(id);
        }

        const card = new ThinkingCard(id, runId);
        card.create();
        this.cards.set(id, card);

        return card;
    }

    append(id, text) {
        const card = this.cards.get(id);
        if (card) {
            card.append(text);
        }
    }

    complete(id, finalText) {
        const card = this.cards.get(id);
        if (card) {
            card.complete(finalText);
        }
    }

    get(id) {
        return this.cards.get(id);
    }

    /**
     * Clear all cards - removes DOM elements and clears the map
     */
    clear() {
        this.cards.forEach((card) => {
            card.destroy();
        });
        this.cards.clear();
    }
}

// Singleton instance
export const thinkingCards = new ThinkingCardManager();

