import { describe, it, expect } from "vitest";
import type {
  UserInput,
  AgentMessageContent,
  UserMessageItem,
  AgentMessageItem,
  ReasoningItem,
  WebSearchItem,
  TurnItem,
} from "./items.js";
import {
  getTurnItemId,
  createUserMessageItem,
  createAgentMessageItem,
  extractUserMessageText,
  extractUserMessageImages,
  extractAgentMessageText,
} from "./items.js";

describe("Protocol Items", () => {
  describe("UserInput", () => {
    it("creates text input", () => {
      const input: UserInput = {
        type: "text",
        text: "Hello, world!",
      };

      expect(input.type).toBe("text");
      expect(input.text).toBe("Hello, world!");
    });

    it("creates image input", () => {
      const input: UserInput = {
        type: "image",
        image_url: "data:image/png;base64,abc123",
      };

      expect(input.type).toBe("image");
      expect(input.image_url).toBe("data:image/png;base64,abc123");
    });

    it("creates local image input", () => {
      const input: UserInput = {
        type: "local_image",
        path: "/path/to/image.png",
      };

      expect(input.type).toBe("local_image");
      expect(input.path).toBe("/path/to/image.png");
    });

    it("serializes to JSON correctly", () => {
      const inputs: UserInput[] = [
        { type: "text", text: "Hello" },
        { type: "image", image_url: "data:image/png;base64,123" },
        { type: "local_image", path: "/image.jpg" },
      ];

      const json = JSON.stringify(inputs);
      const parsed: UserInput[] = JSON.parse(json);

      expect(parsed).toHaveLength(3);
      expect(parsed[0].type).toBe("text");
      expect(parsed[1].type).toBe("image");
      expect(parsed[2].type).toBe("local_image");
    });
  });

  describe("AgentMessageContent", () => {
    it("creates text content", () => {
      const content: AgentMessageContent = {
        type: "text",
        text: "This is a response",
      };

      expect(content.type).toBe("text");
      expect(content.text).toBe("This is a response");
    });

    it("serializes to JSON correctly", () => {
      const content: AgentMessageContent = {
        type: "text",
        text: "Response text",
      };

      const json = JSON.stringify(content);
      expect(json).toContain('"type":"text"');
      expect(json).toContain('"text":"Response text"');
    });
  });

  describe("UserMessageItem", () => {
    it("creates a valid user message item", () => {
      const item: UserMessageItem = {
        id: "msg-123",
        content: [
          { type: "text", text: "Hello" },
          { type: "text", text: " world" },
        ],
      };

      expect(item.id).toBe("msg-123");
      expect(item.content).toHaveLength(2);
    });

    it("supports mixed content types", () => {
      const item: UserMessageItem = {
        id: "msg-456",
        content: [
          { type: "text", text: "Check this image:" },
          { type: "image", image_url: "data:image/png;base64,xyz" },
          { type: "text", text: "What do you see?" },
        ],
      };

      expect(item.content).toHaveLength(3);
      expect(item.content[0].type).toBe("text");
      expect(item.content[1].type).toBe("image");
      expect(item.content[2].type).toBe("text");
    });

    it("serializes to JSON correctly", () => {
      const item: UserMessageItem = {
        id: "msg-789",
        content: [{ type: "text", text: "Test" }],
      };

      const json = JSON.stringify(item);
      const parsed: UserMessageItem = JSON.parse(json);

      expect(parsed.id).toBe("msg-789");
      expect(parsed.content[0].type).toBe("text");
    });
  });

  describe("AgentMessageItem", () => {
    it("creates a valid agent message item", () => {
      const item: AgentMessageItem = {
        id: "agent-123",
        content: [{ type: "text", text: "I can help with that." }],
      };

      expect(item.id).toBe("agent-123");
      expect(item.content).toHaveLength(1);
      expect(item.content[0].text).toBe("I can help with that.");
    });

    it("supports multiple content blocks", () => {
      const item: AgentMessageItem = {
        id: "agent-456",
        content: [
          { type: "text", text: "First part." },
          { type: "text", text: "Second part." },
          { type: "text", text: "Third part." },
        ],
      };

      expect(item.content).toHaveLength(3);
    });

    it("serializes to JSON correctly", () => {
      const item: AgentMessageItem = {
        id: "agent-789",
        content: [{ type: "text", text: "Response" }],
      };

      const json = JSON.stringify(item);
      const parsed: AgentMessageItem = JSON.parse(json);

      expect(parsed.id).toBe("agent-789");
      expect(parsed.content[0].text).toBe("Response");
    });
  });

  describe("ReasoningItem", () => {
    it("creates a valid reasoning item", () => {
      const item: ReasoningItem = {
        id: "reasoning-123",
        summary_text: ["First thought", "Second thought"],
        raw_content: ["Raw 1", "Raw 2"],
      };

      expect(item.id).toBe("reasoning-123");
      expect(item.summary_text).toHaveLength(2);
      expect(item.raw_content).toHaveLength(2);
    });

    it("supports optional raw_content", () => {
      const item: ReasoningItem = {
        id: "reasoning-456",
        summary_text: ["Summary only"],
      };

      expect(item.summary_text).toHaveLength(1);
      expect(item.raw_content).toBeUndefined();
    });

    it("serializes to JSON correctly", () => {
      const item: ReasoningItem = {
        id: "reasoning-789",
        summary_text: ["Thinking..."],
        raw_content: ["<thinking>...</thinking>"],
      };

      const json = JSON.stringify(item);
      const parsed: ReasoningItem = JSON.parse(json);

      expect(parsed.id).toBe("reasoning-789");
      expect(parsed.summary_text).toEqual(["Thinking..."]);
      expect(parsed.raw_content).toEqual(["<thinking>...</thinking>"]);
    });

    it("handles empty arrays", () => {
      const item: ReasoningItem = {
        id: "reasoning-empty",
        summary_text: [],
        raw_content: [],
      };

      expect(item.summary_text).toHaveLength(0);
      expect(item.raw_content).toHaveLength(0);
    });
  });

  describe("WebSearchItem", () => {
    it("creates a valid web search item", () => {
      const item: WebSearchItem = {
        id: "search-123",
        query: "TypeScript best practices",
      };

      expect(item.id).toBe("search-123");
      expect(item.query).toBe("TypeScript best practices");
    });

    it("serializes to JSON correctly", () => {
      const item: WebSearchItem = {
        id: "search-456",
        query: "codex documentation",
      };

      const json = JSON.stringify(item);
      const parsed: WebSearchItem = JSON.parse(json);

      expect(parsed.id).toBe("search-456");
      expect(parsed.query).toBe("codex documentation");
    });

    it("handles special characters in query", () => {
      const item: WebSearchItem = {
        id: "search-789",
        query: 'How to use "quotes" & <tags>?',
      };

      const json = JSON.stringify(item);
      const parsed: WebSearchItem = JSON.parse(json);
      expect(parsed.query).toBe('How to use "quotes" & <tags>?');
    });
  });

  describe("TurnItem", () => {
    it("creates user message turn item", () => {
      const userMsg: UserMessageItem = {
        id: "user-1",
        content: [{ type: "text", text: "Hello" }],
      };

      const turnItem: TurnItem = {
        type: "user_message",
        item: userMsg,
      };

      expect(turnItem.type).toBe("user_message");
      expect(turnItem.item.id).toBe("user-1");
    });

    it("creates agent message turn item", () => {
      const agentMsg: AgentMessageItem = {
        id: "agent-1",
        content: [{ type: "text", text: "Hi there" }],
      };

      const turnItem: TurnItem = {
        type: "agent_message",
        item: agentMsg,
      };

      expect(turnItem.type).toBe("agent_message");
      expect(turnItem.item.id).toBe("agent-1");
    });

    it("creates reasoning turn item", () => {
      const reasoning: ReasoningItem = {
        id: "reasoning-1",
        summary_text: ["Analyzing..."],
      };

      const turnItem: TurnItem = {
        type: "reasoning",
        item: reasoning,
      };

      expect(turnItem.type).toBe("reasoning");
      expect(turnItem.item.id).toBe("reasoning-1");
    });

    it("creates web search turn item", () => {
      const search: WebSearchItem = {
        id: "search-1",
        query: "test query",
      };

      const turnItem: TurnItem = {
        type: "web_search",
        item: search,
      };

      expect(turnItem.type).toBe("web_search");
      expect(turnItem.item.id).toBe("search-1");
    });

    it("serializes all turn item types to JSON", () => {
      const turnItems: TurnItem[] = [
        {
          type: "user_message",
          item: { id: "u1", content: [{ type: "text", text: "Q" }] },
        },
        {
          type: "agent_message",
          item: { id: "a1", content: [{ type: "text", text: "A" }] },
        },
        {
          type: "reasoning",
          item: { id: "r1", summary_text: ["..."] },
        },
        {
          type: "web_search",
          item: { id: "s1", query: "test" },
        },
      ];

      const json = JSON.stringify(turnItems);
      const parsed: TurnItem[] = JSON.parse(json);

      expect(parsed).toHaveLength(4);
      expect(parsed[0].type).toBe("user_message");
      expect(parsed[1].type).toBe("agent_message");
      expect(parsed[2].type).toBe("reasoning");
      expect(parsed[3].type).toBe("web_search");
    });
  });

  describe("Helper Functions", () => {
    describe("getTurnItemId", () => {
      it("extracts ID from user message turn item", () => {
        const turnItem: TurnItem = {
          type: "user_message",
          item: { id: "msg-123", content: [] },
        };

        expect(getTurnItemId(turnItem)).toBe("msg-123");
      });

      it("extracts ID from agent message turn item", () => {
        const turnItem: TurnItem = {
          type: "agent_message",
          item: { id: "agent-456", content: [] },
        };

        expect(getTurnItemId(turnItem)).toBe("agent-456");
      });

      it("extracts ID from reasoning turn item", () => {
        const turnItem: TurnItem = {
          type: "reasoning",
          item: { id: "reasoning-789", summary_text: [] },
        };

        expect(getTurnItemId(turnItem)).toBe("reasoning-789");
      });

      it("extracts ID from web search turn item", () => {
        const turnItem: TurnItem = {
          type: "web_search",
          item: { id: "search-999", query: "test" },
        };

        expect(getTurnItemId(turnItem)).toBe("search-999");
      });
    });

    describe("createUserMessageItem", () => {
      it("creates user message with generated UUID", () => {
        const content: UserInput[] = [{ type: "text", text: "Hello" }];
        const item = createUserMessageItem(content);

        expect(item.id).toBeTruthy();
        expect(item.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(item.content).toEqual(content);
      });

      it("generates unique IDs for different items", () => {
        const item1 = createUserMessageItem([{ type: "text", text: "A" }]);
        const item2 = createUserMessageItem([{ type: "text", text: "B" }]);

        expect(item1.id).not.toBe(item2.id);
      });
    });

    describe("createAgentMessageItem", () => {
      it("creates agent message with generated UUID", () => {
        const content: AgentMessageContent[] = [
          { type: "text", text: "Response" },
        ];
        const item = createAgentMessageItem(content);

        expect(item.id).toBeTruthy();
        expect(item.id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
        expect(item.content).toEqual(content);
      });

      it("generates unique IDs for different items", () => {
        const item1 = createAgentMessageItem([{ type: "text", text: "A" }]);
        const item2 = createAgentMessageItem([{ type: "text", text: "B" }]);

        expect(item1.id).not.toBe(item2.id);
      });
    });

    describe("extractUserMessageText", () => {
      it("extracts text from single text input", () => {
        const item: UserMessageItem = {
          id: "msg-1",
          content: [{ type: "text", text: "Hello world" }],
        };

        expect(extractUserMessageText(item)).toBe("Hello world");
      });

      it("concatenates multiple text inputs", () => {
        const item: UserMessageItem = {
          id: "msg-2",
          content: [
            { type: "text", text: "Hello" },
            { type: "text", text: " " },
            { type: "text", text: "world" },
          ],
        };

        expect(extractUserMessageText(item)).toBe("Hello world");
      });

      it("ignores non-text inputs", () => {
        const item: UserMessageItem = {
          id: "msg-3",
          content: [
            { type: "text", text: "Before" },
            { type: "image", image_url: "data:image/png;base64,123" },
            { type: "text", text: "After" },
          ],
        };

        expect(extractUserMessageText(item)).toBe("BeforeAfter");
      });

      it("returns empty string for no text content", () => {
        const item: UserMessageItem = {
          id: "msg-4",
          content: [{ type: "image", image_url: "data:image/png;base64,123" }],
        };

        expect(extractUserMessageText(item)).toBe("");
      });
    });

    describe("extractUserMessageImages", () => {
      it("extracts image URLs", () => {
        const item: UserMessageItem = {
          id: "msg-1",
          content: [
            { type: "image", image_url: "data:image/png;base64,123" },
            { type: "image", image_url: "data:image/jpeg;base64,456" },
          ],
        };

        const images = extractUserMessageImages(item);
        expect(images).toHaveLength(2);
        expect(images[0]).toBe("data:image/png;base64,123");
        expect(images[1]).toBe("data:image/jpeg;base64,456");
      });

      it("ignores non-image inputs", () => {
        const item: UserMessageItem = {
          id: "msg-2",
          content: [
            { type: "text", text: "Hello" },
            { type: "image", image_url: "data:image/png;base64,123" },
            { type: "local_image", path: "/image.jpg" },
          ],
        };

        const images = extractUserMessageImages(item);
        expect(images).toHaveLength(1);
        expect(images[0]).toBe("data:image/png;base64,123");
      });

      it("returns empty array for no images", () => {
        const item: UserMessageItem = {
          id: "msg-3",
          content: [{ type: "text", text: "No images here" }],
        };

        expect(extractUserMessageImages(item)).toEqual([]);
      });
    });

    describe("extractAgentMessageText", () => {
      it("extracts text from agent message content", () => {
        const item: AgentMessageItem = {
          id: "agent-1",
          content: [
            { type: "text", text: "First response" },
            { type: "text", text: "Second response" },
          ],
        };

        const texts = extractAgentMessageText(item);
        expect(texts).toEqual(["First response", "Second response"]);
      });

      it("returns empty array for no content", () => {
        const item: AgentMessageItem = {
          id: "agent-2",
          content: [],
        };

        expect(extractAgentMessageText(item)).toEqual([]);
      });
    });
  });
});
