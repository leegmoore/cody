import { ResponseReducer } from './reducer.bundle.js';
import { state } from './state.js';
import {
    updateStatus,
    addSystemMessage,
    removeThinkingPlaceholder,
    renderResponseItems
} from './ui.js';
import { thinkingCards } from './thinking-card.js';

const STREAM_EVENT_TYPES = [
    'response_start',
    'item_start',
    'item_delta',
    'item_done',
    'item_error',
    'item_cancelled',
    'response_done',
    'response_error',
    'usage_update',
    'turn_aborted_by_user',
];

/**
 * Track provider per run to determine if we should show thinking cards
 * Only Anthropic reasoning gets thinking cards; others use generic shimmer
 */
const runProviders = new Map();

/**
 * Route thinking-related events to ThinkingCardManager
 * Only creates cards for Anthropic reasoning; other providers use generic shimmer
 */
function handleThinkingEvent(event, runId) {
    const payload = event.payload;
    if (!payload) return;

    // Track provider from response_start
    if (payload.type === 'response_start' && payload.provider_id) {
        runProviders.set(runId, payload.provider_id);
        return;
    }

    // Only create thinking cards for Anthropic reasoning
    const provider = runProviders.get(runId);
    if (provider !== 'anthropic') {
        // For non-Anthropic providers (OpenAI, encrypted, etc.), use generic shimmer
        // The shimmer is already shown when message is sent and removed when response items arrive
        return;
    }

    // item_start for reasoning -> create card (Anthropic only)
    if (payload.type === 'item_start' && payload.item_type === 'reasoning') {
        thinkingCards.create(payload.item_id, runId);
        return;
    }

    // item_delta -> only append if we have a reasoning card for this item_id
    if (payload.type === 'item_delta') {
        const card = thinkingCards.get(payload.item_id);
        // Only append if card exists (meaning it was created from item_start with item_type='reasoning')
        if (card) {
            thinkingCards.append(payload.item_id, payload.delta_content);
        }
        // If no card exists, this delta is for a message or other item type - ignore it
        return;
    }

    // item_done for reasoning -> complete card (Anthropic only)
    if (payload.type === 'item_done' && payload.final_item?.type === 'reasoning') {
        const card = thinkingCards.get(payload.item_id);
        // If card doesn't exist yet, create it (reasoning came as summary, not streamed)
        if (!card) {
            thinkingCards.create(payload.item_id, runId);
        }
        // Complete with final content (will only use it if no content was streamed)
        thinkingCards.complete(payload.item_id, payload.final_item.content);
        return;
    }
}

export function streamRun(runId, context) {
    if (state.eventSource) {
        state.eventSource.close();
    }

    const streamUrl = `${state.API_BASE}/stream/${runId}`;
    const eventSource = new EventSource(streamUrl);
    const reducer = new ResponseReducer();
    state.eventSource = eventSource;

    const handleEvent = (event) => {
        try {
            const parsed = JSON.parse(event.data);

            // Handle thinking events directly (before reducer)
            handleThinkingEvent(parsed, runId);

            const snapshot = reducer.apply(parsed);
            if (!snapshot) return;

            removeThinkingPlaceholder();
            renderResponseItems(snapshot.output_items || [], {
                runId,
                threadId: context.threadId,
                status: snapshot.status,
            });

            if (snapshot.status === 'complete') {
                finalize('complete');
            }
            if (snapshot.status === 'error') {
                finalize('error', snapshot.error?.message);
            }
        } catch (error) {
            console.error('Failed to process stream event', error);
        }
    };

    STREAM_EVENT_TYPES.forEach((type) => {
        eventSource.addEventListener(type, handleEvent);
    });

    eventSource.onerror = (err) => {
        console.error('Stream error', err);
        finalize('error', 'Stream connection failed');
    };

    function finalize(status, errorMessage) {
        if (eventSource) {
            STREAM_EVENT_TYPES.forEach((type) => {
                eventSource.removeEventListener(type, handleEvent);
            });
            eventSource.close();
        }
        state.eventSource = null;
        const sendButton = document.getElementById('sendButton');
        if (sendButton) sendButton.disabled = false;

        if (status === 'error' && errorMessage) {
            addSystemMessage(errorMessage);
            updateStatus('Error', 'red');
        } else {
            updateStatus('Connected', 'green');
        }

        state.runAgentAnchors.delete(runId);
        runProviders.delete(runId); // Clean up provider tracking
        window.dispatchEvent(new CustomEvent('run-complete', { detail: { runId } }));
    }
}
