/**
 * Tests for protocol/models.ts
 */

import { describe, it, expect } from 'vitest';
import type {
  ContentItem,
  ResponseInputItem,
  ResponseItem,
  LocalShellStatus,
  LocalShellAction,
  LocalShellExecAction,
  WebSearchAction,
  ReasoningItemReasoningSummary,
  ReasoningItemContent,
  GhostCommit,
  ShellToolCallParams,
  FunctionCallOutputContentItem,
  FunctionCallOutputPayload,
  CallToolResult,
  ContentBlock,
} from './models.js';
import {
  responseInputItemToResponseItem,
  userInputToResponseInputItem,
  callToolResultToOutputPayload,
  serializeFunctionCallOutputPayload,
  deserializeFunctionCallOutputPayload,
  shouldSerializeReasoningContent,
} from './models.js';
import type { UserInput } from './items.js';

describe('ContentItem', () => {
  it('should create input_text content item', () => {
    const item: ContentItem = {
      type: 'input_text',
      text: 'Hello, world!',
    };
    expect(item.type).toBe('input_text');
    expect(item.text).toBe('Hello, world!');
  });

  it('should create input_image content item', () => {
    const item: ContentItem = {
      type: 'input_image',
      image_url: 'data:image/png;base64,iVBORw0KGgo=',
    };
    expect(item.type).toBe('input_image');
    expect(item.image_url).toContain('data:image/png');
  });

  it('should create output_text content item', () => {
    const item: ContentItem = {
      type: 'output_text',
      text: 'Response text',
    };
    expect(item.type).toBe('output_text');
    expect(item.text).toBe('Response text');
  });

  it('should serialize content items to JSON', () => {
    const items: ContentItem[] = [
      { type: 'input_text', text: 'test' },
      { type: 'input_image', image_url: 'data:image/png;base64,ABC' },
      { type: 'output_text', text: 'output' },
    ];
    const json = JSON.stringify(items);
    const parsed = JSON.parse(json) as ContentItem[];
    expect(parsed).toEqual(items);
  });
});

describe('ResponseInputItem', () => {
  it('should create message input item', () => {
    const item: ResponseInputItem = {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'Hello' }],
    };
    expect(item.type).toBe('message');
    expect(item.role).toBe('user');
    expect(item.content).toHaveLength(1);
  });

  it('should create function_call_output input item', () => {
    const item: ResponseInputItem = {
      type: 'function_call_output',
      call_id: 'call_123',
      output: { content: 'success', success: true },
    };
    expect(item.type).toBe('function_call_output');
    expect(item.call_id).toBe('call_123');
    expect(item.output.content).toBe('success');
  });

  it('should create mcp_tool_call_output input item with success', () => {
    const result: CallToolResult = {
      content: [{ type: 'text', text: 'Result' }],
      is_error: false,
    };
    const item: ResponseInputItem = {
      type: 'mcp_tool_call_output',
      call_id: 'mcp_456',
      result,
    };
    expect(item.type).toBe('mcp_tool_call_output');
    expect(item.call_id).toBe('mcp_456');
    expect('content' in item.result).toBe(true);
  });

  it('should create mcp_tool_call_output input item with error', () => {
    const item: ResponseInputItem = {
      type: 'mcp_tool_call_output',
      call_id: 'mcp_789',
      result: { error: 'Tool failed' },
    };
    expect(item.type).toBe('mcp_tool_call_output');
    expect('error' in item.result).toBe(true);
  });

  it('should create custom_tool_call_output input item', () => {
    const item: ResponseInputItem = {
      type: 'custom_tool_call_output',
      call_id: 'custom_001',
      output: 'Custom output',
    };
    expect(item.type).toBe('custom_tool_call_output');
    expect(item.output).toBe('Custom output');
  });

  it('should serialize and deserialize ResponseInputItem', () => {
    const item: ResponseInputItem = {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Response' }],
    };
    const json = JSON.stringify(item);
    const parsed = JSON.parse(json) as ResponseInputItem;
    expect(parsed).toEqual(item);
  });
});

describe('ResponseItem', () => {
  it('should create message response item', () => {
    const item: ResponseItem = {
      type: 'message',
      id: 'msg_001',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Hello!' }],
    };
    expect(item.type).toBe('message');
    expect(item.role).toBe('assistant');
  });

  it('should create reasoning response item', () => {
    const item: ResponseItem = {
      type: 'reasoning',
      id: 'reason_001',
      summary: [{ type: 'summary_text', text: 'Thinking...' }],
      content: [{ type: 'reasoning_text', text: 'Step 1...' }],
    };
    expect(item.type).toBe('reasoning');
    expect(item.summary).toHaveLength(1);
    expect(item.content).toHaveLength(1);
  });

  it('should create local_shell_call response item', () => {
    const item: ResponseItem = {
      type: 'local_shell_call',
      id: 'shell_001',
      status: 'completed',
      action: {
        type: 'exec',
        command: ['ls', '-la'],
        timeout_ms: 5000,
      },
    };
    expect(item.type).toBe('local_shell_call');
    expect(item.status).toBe('completed');
    expect(item.action.command).toEqual(['ls', '-la']);
  });

  it('should create function_call response item', () => {
    const item: ResponseItem = {
      type: 'function_call',
      id: 'fn_001',
      name: 'get_weather',
      arguments: '{"city":"San Francisco"}',
      call_id: 'call_123',
    };
    expect(item.type).toBe('function_call');
    expect(item.name).toBe('get_weather');
    expect(JSON.parse(item.arguments)).toEqual({ city: 'San Francisco' });
  });

  it('should create function_call_output response item', () => {
    const item: ResponseItem = {
      type: 'function_call_output',
      call_id: 'call_123',
      output: { content: '{"temp":72}', success: true },
    };
    expect(item.type).toBe('function_call_output');
    expect(item.output.success).toBe(true);
  });

  it('should create custom_tool_call response item', () => {
    const item: ResponseItem = {
      type: 'custom_tool_call',
      id: 'custom_001',
      status: 'completed',
      call_id: 'cust_123',
      name: 'custom_tool',
      input: '{"param":"value"}',
    };
    expect(item.type).toBe('custom_tool_call');
    expect(item.name).toBe('custom_tool');
  });

  it('should create custom_tool_call_output response item', () => {
    const item: ResponseItem = {
      type: 'custom_tool_call_output',
      call_id: 'cust_123',
      output: 'Tool result',
    };
    expect(item.type).toBe('custom_tool_call_output');
    expect(item.output).toBe('Tool result');
  });

  it('should create web_search_call response item', () => {
    const item: ResponseItem = {
      type: 'web_search_call',
      id: 'ws_001',
      status: 'completed',
      action: { type: 'search', query: 'TypeScript best practices' },
    };
    expect(item.type).toBe('web_search_call');
    expect(item.action.type).toBe('search');
  });

  it('should create ghost_snapshot response item', () => {
    const ghostCommit: GhostCommit = {
      id: 'abc123',
      parent: 'def456',
      preexisting_untracked_files: ['file.txt'],
      preexisting_untracked_dirs: ['temp/'],
    };
    const item: ResponseItem = {
      type: 'ghost_snapshot',
      ghost_commit: ghostCommit,
    };
    expect(item.type).toBe('ghost_snapshot');
    expect(item.ghost_commit.id).toBe('abc123');
  });

  it('should create other response item', () => {
    const item: ResponseItem = {
      type: 'other',
    };
    expect(item.type).toBe('other');
  });
});

describe('LocalShellStatus', () => {
  it('should accept valid status values', () => {
    const statuses: LocalShellStatus[] = [
      'completed',
      'in_progress',
      'incomplete',
    ];
    statuses.forEach((status) => {
      expect(['completed', 'in_progress', 'incomplete']).toContain(status);
    });
  });

  it('should serialize status to JSON', () => {
    const status: LocalShellStatus = 'in_progress';
    const json = JSON.stringify(status);
    expect(json).toBe('"in_progress"');
  });
});

describe('LocalShellAction', () => {
  it('should create exec action', () => {
    const action: LocalShellAction = {
      type: 'exec',
      command: ['npm', 'test'],
      timeout_ms: 30000,
      working_directory: '/app',
      env: { NODE_ENV: 'test' },
      user: 'testuser',
    };
    expect(action.type).toBe('exec');
    expect(action.command).toEqual(['npm', 'test']);
    expect(action.timeout_ms).toBe(30000);
    expect(action.env).toEqual({ NODE_ENV: 'test' });
  });

  it('should create exec action with minimal fields', () => {
    const action: LocalShellAction = {
      type: 'exec',
      command: ['echo', 'hello'],
    };
    expect(action.type).toBe('exec');
    expect(action.timeout_ms).toBeUndefined();
  });
});

describe('WebSearchAction', () => {
  it('should create search action', () => {
    const action: WebSearchAction = {
      type: 'search',
      query: 'machine learning tutorials',
    };
    expect(action.type).toBe('search');
    expect(action.query).toBe('machine learning tutorials');
  });

  it('should create other action', () => {
    const action: WebSearchAction = {
      type: 'other',
    };
    expect(action.type).toBe('other');
  });
});

describe('ReasoningItemReasoningSummary', () => {
  it('should create summary_text', () => {
    const summary: ReasoningItemReasoningSummary = {
      type: 'summary_text',
      text: 'Analyzing the problem...',
    };
    expect(summary.type).toBe('summary_text');
    expect(summary.text).toBe('Analyzing the problem...');
  });
});

describe('ReasoningItemContent', () => {
  it('should create reasoning_text content', () => {
    const content: ReasoningItemContent = {
      type: 'reasoning_text',
      text: 'First, I need to...',
    };
    expect(content.type).toBe('reasoning_text');
    expect(content.text).toBe('First, I need to...');
  });

  it('should create text content', () => {
    const content: ReasoningItemContent = {
      type: 'text',
      text: 'Regular text',
    };
    expect(content.type).toBe('text');
    expect(content.text).toBe('Regular text');
  });
});

describe('GhostCommit', () => {
  it('should create ghost commit with all fields', () => {
    const commit: GhostCommit = {
      id: 'commit_abc',
      parent: 'commit_def',
      preexisting_untracked_files: ['file1.txt', 'file2.txt'],
      preexisting_untracked_dirs: ['node_modules/', '.cache/'],
    };
    expect(commit.id).toBe('commit_abc');
    expect(commit.parent).toBe('commit_def');
    expect(commit.preexisting_untracked_files).toHaveLength(2);
  });

  it('should create ghost commit without parent', () => {
    const commit: GhostCommit = {
      id: 'commit_xyz',
      preexisting_untracked_files: [],
      preexisting_untracked_dirs: [],
    };
    expect(commit.parent).toBeUndefined();
    expect(commit.preexisting_untracked_files).toEqual([]);
  });
});

describe('ShellToolCallParams', () => {
  it('should create shell params with all fields', () => {
    const params: ShellToolCallParams = {
      command: ['docker', 'run', 'image'],
      workdir: '/workspace',
      timeout_ms: 60000,
      with_escalated_permissions: true,
      justification: 'Need root access for system operation',
    };
    expect(params.command).toEqual(['docker', 'run', 'image']);
    expect(params.with_escalated_permissions).toBe(true);
    expect(params.justification).toBeDefined();
  });

  it('should create shell params with minimal fields', () => {
    const params: ShellToolCallParams = {
      command: ['ls'],
    };
    expect(params.command).toEqual(['ls']);
    expect(params.workdir).toBeUndefined();
  });
});

describe('FunctionCallOutputContentItem', () => {
  it('should create input_text item', () => {
    const item: FunctionCallOutputContentItem = {
      type: 'input_text',
      text: 'Output text',
    };
    expect(item.type).toBe('input_text');
    expect(item.text).toBe('Output text');
  });

  it('should create input_image item', () => {
    const item: FunctionCallOutputContentItem = {
      type: 'input_image',
      image_url: 'data:image/jpeg;base64,/9j/',
    };
    expect(item.type).toBe('input_image');
    expect(item.image_url).toContain('data:image/jpeg');
  });
});

describe('FunctionCallOutputPayload', () => {
  it('should create payload with plain content', () => {
    const payload: FunctionCallOutputPayload = {
      content: 'Simple string output',
      success: true,
    };
    expect(payload.content).toBe('Simple string output');
    expect(payload.success).toBe(true);
    expect(payload.content_items).toBeUndefined();
  });

  it('should create payload with content items', () => {
    const items: FunctionCallOutputContentItem[] = [
      { type: 'input_text', text: 'Result' },
      { type: 'input_image', image_url: 'data:image/png;base64,ABC' },
    ];
    const payload: FunctionCallOutputPayload = {
      content: JSON.stringify(items),
      content_items: items,
      success: true,
    };
    expect(payload.content_items).toHaveLength(2);
    expect(payload.success).toBe(true);
  });

  it('should create payload with failure', () => {
    const payload: FunctionCallOutputPayload = {
      content: 'Error occurred',
      success: false,
    };
    expect(payload.success).toBe(false);
  });
});

describe('Helper Functions', () => {
  describe('responseInputItemToResponseItem', () => {
    it('should convert message input to response', () => {
      const input: ResponseInputItem = {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'Test' }],
      };
      const response = responseInputItemToResponseItem(input);
      expect(response.type).toBe('message');
      if (response.type === 'message') {
        expect(response.role).toBe('user');
        expect(response.id).toBeUndefined();
      }
    });

    it('should convert function_call_output input to response', () => {
      const input: ResponseInputItem = {
        type: 'function_call_output',
        call_id: 'call_123',
        output: { content: 'result', success: true },
      };
      const response = responseInputItemToResponseItem(input);
      expect(response.type).toBe('function_call_output');
    });

    it('should convert mcp_tool_call_output success to response', () => {
      const input: ResponseInputItem = {
        type: 'mcp_tool_call_output',
        call_id: 'mcp_123',
        result: {
          content: [{ type: 'text', text: 'Success' }],
          is_error: false,
        },
      };
      const response = responseInputItemToResponseItem(input);
      expect(response.type).toBe('function_call_output');
    });

    it('should convert mcp_tool_call_output error to response', () => {
      const input: ResponseInputItem = {
        type: 'mcp_tool_call_output',
        call_id: 'mcp_456',
        result: { error: 'Tool failed' },
      };
      const response = responseInputItemToResponseItem(input);
      expect(response.type).toBe('function_call_output');
      if (response.type === 'function_call_output') {
        expect(response.output.content).toContain('err:');
        expect(response.output.success).toBe(false);
      }
    });

    it('should convert custom_tool_call_output to response', () => {
      const input: ResponseInputItem = {
        type: 'custom_tool_call_output',
        call_id: 'custom_789',
        output: 'Custom result',
      };
      const response = responseInputItemToResponseItem(input);
      expect(response.type).toBe('custom_tool_call_output');
    });
  });

  describe('userInputToResponseInputItem', () => {
    it('should convert text input', () => {
      const inputs: UserInput[] = [{ type: 'text', text: 'Hello' }];
      const item = userInputToResponseInputItem(inputs);
      expect(item.type).toBe('message');
      expect(item.role).toBe('user');
      expect(item.content).toHaveLength(1);
      expect(item.content[0]).toEqual({ type: 'input_text', text: 'Hello' });
    });

    it('should convert image input', () => {
      const inputs: UserInput[] = [
        { type: 'image', image_url: 'data:image/png;base64,XYZ' },
      ];
      const item = userInputToResponseInputItem(inputs);
      expect(item.content[0]).toEqual({
        type: 'input_image',
        image_url: 'data:image/png;base64,XYZ',
      });
    });

    it('should convert local_image input to placeholder', () => {
      const inputs: UserInput[] = [
        { type: 'local_image', path: '/path/to/image.png' },
      ];
      const item = userInputToResponseInputItem(inputs);
      expect(item.content[0].type).toBe('input_text');
      if (item.content[0].type === 'input_text') {
        expect(item.content[0].text).toContain('/path/to/image.png');
      }
    });

    it('should convert mixed inputs', () => {
      const inputs: UserInput[] = [
        { type: 'text', text: 'Check this:' },
        { type: 'image', image_url: 'data:image/jpeg;base64,ABC' },
        { type: 'text', text: 'What do you see?' },
      ];
      const item = userInputToResponseInputItem(inputs);
      expect(item.content).toHaveLength(3);
      expect(item.content[0].type).toBe('input_text');
      expect(item.content[1].type).toBe('input_image');
      expect(item.content[2].type).toBe('input_text');
    });
  });

  describe('callToolResultToOutputPayload', () => {
    it('should convert text-only result', () => {
      const result: CallToolResult = {
        content: [{ type: 'text', text: 'Success' }],
        is_error: false,
      };
      const payload = callToolResultToOutputPayload(result);
      expect(payload.success).toBe(true);
      expect(payload.content).toBeDefined();
      // Text-only should not have content_items
      expect(payload.content_items).toBeUndefined();
    });

    it('should convert result with image', () => {
      const result: CallToolResult = {
        content: [
          { type: 'text', text: 'Caption' },
          { type: 'image', data: 'BASE64', mime_type: 'image/png' },
        ],
        is_error: false,
      };
      const payload = callToolResultToOutputPayload(result);
      expect(payload.success).toBe(true);
      expect(payload.content_items).toHaveLength(2);
      expect(payload.content_items?.[1].type).toBe('input_image');
    });

    it('should convert error result', () => {
      const result: CallToolResult = {
        content: [{ type: 'text', text: 'Failed' }],
        is_error: true,
      };
      const payload = callToolResultToOutputPayload(result);
      expect(payload.success).toBe(false);
    });

    it('should handle structured_content', () => {
      const result: CallToolResult = {
        content: [],
        structured_content: { key: 'value', data: 123 },
        is_error: false,
      };
      const payload = callToolResultToOutputPayload(result);
      expect(payload.success).toBe(true);
      expect(payload.content).toBe('{"key":"value","data":123}');
    });

    it('should add data URL prefix if missing', () => {
      const result: CallToolResult = {
        content: [{ type: 'image', data: 'RAWBASE64', mime_type: 'image/jpeg' }],
        is_error: false,
      };
      const payload = callToolResultToOutputPayload(result);
      const imageItem = payload.content_items?.[0];
      expect(imageItem?.type).toBe('input_image');
      if (imageItem?.type === 'input_image') {
        expect(imageItem.image_url).toBe('data:image/jpeg;base64,RAWBASE64');
      }
    });
  });

  describe('serializeFunctionCallOutputPayload', () => {
    it('should serialize string content', () => {
      const payload: FunctionCallOutputPayload = {
        content: 'plain text',
        success: true,
      };
      const serialized = serializeFunctionCallOutputPayload(payload);
      expect(serialized).toBe('plain text');
    });

    it('should serialize content_items as array', () => {
      const items: FunctionCallOutputContentItem[] = [
        { type: 'input_text', text: 'result' },
      ];
      const payload: FunctionCallOutputPayload = {
        content: JSON.stringify(items),
        content_items: items,
        success: true,
      };
      const serialized = serializeFunctionCallOutputPayload(payload);
      expect(Array.isArray(serialized)).toBe(true);
      expect(serialized).toEqual(items);
    });
  });

  describe('deserializeFunctionCallOutputPayload', () => {
    it('should deserialize string content', () => {
      const payload = deserializeFunctionCallOutputPayload('simple output');
      expect(payload.content).toBe('simple output');
      expect(payload.content_items).toBeUndefined();
      expect(payload.success).toBeUndefined();
    });

    it('should deserialize array content', () => {
      const items: FunctionCallOutputContentItem[] = [
        { type: 'input_text', text: 'note' },
        { type: 'input_image', image_url: 'data:image/png;base64,XYZ' },
      ];
      const payload = deserializeFunctionCallOutputPayload(items);
      expect(payload.content_items).toEqual(items);
      expect(payload.content).toBe(JSON.stringify(items));
      expect(payload.success).toBeUndefined();
    });
  });

  describe('shouldSerializeReasoningContent', () => {
    it('should return false for undefined content', () => {
      expect(shouldSerializeReasoningContent(undefined)).toBe(false);
    });

    it('should return false for empty content', () => {
      expect(shouldSerializeReasoningContent([])).toBe(false);
    });

    it('should return true if reasoning_text is present', () => {
      const content: ReasoningItemContent[] = [
        { type: 'reasoning_text', text: 'thinking...' },
      ];
      expect(shouldSerializeReasoningContent(content)).toBe(true);
    });

    it('should return false if only text is present', () => {
      const content: ReasoningItemContent[] = [
        { type: 'text', text: 'plain text' },
      ];
      expect(shouldSerializeReasoningContent(content)).toBe(false);
    });

    it('should return true if mixed with reasoning_text', () => {
      const content: ReasoningItemContent[] = [
        { type: 'text', text: 'plain' },
        { type: 'reasoning_text', text: 'thinking' },
      ];
      expect(shouldSerializeReasoningContent(content)).toBe(true);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete function call flow', () => {
    // Create function call
    const call: ResponseItem = {
      type: 'function_call',
      call_id: 'call_001',
      name: 'search',
      arguments: '{"query":"test"}',
    };
    expect(call.type).toBe('function_call');

    // Create function call output
    const output: ResponseItem = {
      type: 'function_call_output',
      call_id: 'call_001',
      output: { content: 'Search results...', success: true },
    };
    expect(output.type).toBe('function_call_output');
  });

  it('should handle shell execution flow', () => {
    const shellCall: ResponseItem = {
      type: 'local_shell_call',
      status: 'in_progress',
      action: {
        type: 'exec',
        command: ['npm', 'test'],
        timeout_ms: 30000,
      },
    };
    expect(shellCall.type).toBe('local_shell_call');

    // Update status to completed
    const completed: ResponseItem = {
      ...shellCall,
      status: 'completed',
    };
    if (completed.type === 'local_shell_call') {
      expect(completed.status).toBe('completed');
    }
  });

  it('should handle reasoning flow with summary and content', () => {
    const reasoning: ResponseItem = {
      type: 'reasoning',
      summary: [{ type: 'summary_text', text: 'Planning approach' }],
      content: [
        { type: 'reasoning_text', text: 'Step 1: Analyze' },
        { type: 'reasoning_text', text: 'Step 2: Execute' },
      ],
    };
    expect(reasoning.type).toBe('reasoning');
    if (reasoning.type === 'reasoning') {
      expect(reasoning.summary).toHaveLength(1);
      expect(reasoning.content).toHaveLength(2);
      expect(shouldSerializeReasoningContent(reasoning.content)).toBe(true);
    }
  });

  it('should convert user input through full pipeline', () => {
    const userInputs: UserInput[] = [
      { type: 'text', text: 'What is this?' },
      { type: 'image', image_url: 'data:image/png;base64,IMAGE' },
    ];

    const inputItem = userInputToResponseInputItem(userInputs);
    expect(inputItem.type).toBe('message');
    expect(inputItem.content).toHaveLength(2);

    const responseItem = responseInputItemToResponseItem(inputItem);
    expect(responseItem.type).toBe('message');
    if (responseItem.type === 'message') {
      expect(responseItem.content).toHaveLength(2);
      expect(responseItem.role).toBe('user');
    }
  });
});
