export interface SSEEvent {
  id?: string;
  event?: string;
  data?: string;
}

function parseBlock(block: string): SSEEvent | null {
  const lines = block
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.startsWith(":"));
  if (lines.length === 0) {
    return null;
  }

  const event: SSEEvent = {};
  for (const line of lines) {
    if (line.startsWith("id:")) {
      event.id = line.slice(3).trim();
    } else if (line.startsWith("event:")) {
      event.event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      const value = line.slice(5).trimStart();
      event.data = event.data ? `${event.data}\n${value}` : value;
    }
  }
  return event;
}

export function parseSSE(text: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const blocks = text.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const parsed = parseBlock(block);
    if (parsed) {
      events.push(parsed);
    }
  }
  return events;
}

export class SSEStreamParser {
  private buffer = "";

  feed(chunk: string): SSEEvent[] {
    this.buffer += chunk;
    const events: SSEEvent[] = [];
    let separator = this.findSeparator();
    while (separator) {
      const block = this.buffer.slice(0, separator.index);
      this.buffer = this.buffer.slice(separator.index + separator.length);
      const parsed = parseBlock(block);
      if (parsed) {
        events.push(parsed);
      }
      separator = this.findSeparator();
    }
    return events;
  }

  flush(): SSEEvent[] {
    const remaining = this.buffer.trim();
    this.buffer = "";
    if (!remaining) {
      return [];
    }
    const parsed = parseBlock(remaining);
    return parsed ? [parsed] : [];
  }

  private findSeparator():
    | { index: number; length: number }
    | undefined {
    const unixIdx = this.buffer.indexOf("\n\n");
    if (unixIdx >= 0) {
      return { index: unixIdx, length: 2 };
    }
    const windowsIdx = this.buffer.indexOf("\r\n\r\n");
    if (windowsIdx >= 0) {
      return { index: windowsIdx, length: 4 };
    }
    return undefined;
  }
}

