import { ResponseReducer } from './reducer.bundle.js';
import { state } from './state.js';
import {
    updateStatus,
    addSystemMessage,
    removeThinkingPlaceholder,
    renderResponseItems
} from './ui.js';

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
        window.dispatchEvent(new CustomEvent('run-complete', { detail: { runId } }));
    }
}
