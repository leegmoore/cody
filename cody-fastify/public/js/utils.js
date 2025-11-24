export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

export function truncateText(value, limit = 120) {
    if (!value || value.length <= limit) {
        return value || '';
    }
    return value.slice(0, limit - 3) + '...';
}

export function formatArgValueForSignature(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') {
        const safe = value.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t').replace(/\"/g, '\\\"').replace(/\'/g, "\\'");
        return `"${truncateText(safe, 60)}"`;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (Array.isArray(value)) {
        return `[${value.slice(0, 3).map(formatArgValueForSignature).join(', ')}${value.length > 3 ? ', …' : ''}]`;
    }
    if (typeof value === 'object') {
        try {
            return truncateText(JSON.stringify(value), 60);
        } catch {
            return '[Object]';
        }
    }
    return String(value);
}

export function formatToolCallSignature(call) {
    const toolLabel = call.toolName || call.type || 'Tool';
    const args = call.arguments;
    if (args === undefined || args === null) {
        return `${toolLabel}()`;
    }
    if (typeof args === 'string') {
        return `${toolLabel}(${truncateText(args, 140)})`;
    }
    if (Array.isArray(args)) {
        return `${toolLabel}([${args.slice(0, 3).map(formatArgValueForSignature).join(', ')}${args.length > 3 ? ', …' : ''}])`;
    }
    if (typeof args === 'object') {
        const entries = Object.entries(args).map(([key, value]) => `${key}: ${formatArgValueForSignature(value)}`);
        return `${toolLabel}({ ${truncateText(entries.join(', '), 140)} })`;
    }
    return `${toolLabel}(${String(args)})`;
}

export function formatToolCallJson(value) {
    if (value === undefined || value === null) {
        return '—';
    }
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export function normalizeRunId(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    return String(value);
}
