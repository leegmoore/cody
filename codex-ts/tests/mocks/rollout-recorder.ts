import { vi } from "vitest";
import type {
  ConversationItem,
  ConversationsPage,
  RolloutCompactionEntry,
  RolloutConversation,
  RolloutItem,
  RolloutLine,
  RolloutRecorder,
  RolloutRecorderParams,
  RolloutStore,
  RolloutTurn,
  SessionMeta,
} from "../../src/core/rollout.js";
import type { Config } from "../../src/core/config.js";

interface StoredConversation {
  id: string;
  path: string;
  lines: RolloutLine[];
  rawOverride?: string | null;
}

export interface MockRolloutEnvironment {
  store: RolloutStore;
  recordItemsSpy: ReturnType<typeof vi.fn>;
  appendTurnSpy: ReturnType<typeof vi.fn>;
  getBuffer(id: string): string;
  setBuffer(id: string, contents: string): void;
}

function serializeLine(line: RolloutLine): string {
  return JSON.stringify(line);
}

function deserializeLines(contents: string): RolloutLine[] {
  return contents
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RolloutLine);
}

export function createMockRolloutEnvironment(): MockRolloutEnvironment {
  const conversations = new Map<string, StoredConversation>();
  const pathToId = new Map<string, string>();
  const recordItemsSpy = vi.fn();
  const appendTurnSpy = vi.fn();

  function ensureConversation(id: string, path: string): StoredConversation {
    let convo = conversations.get(id);
    if (!convo) {
      convo = { id, path, lines: [] };
      conversations.set(id, convo);
      pathToId.set(path, id);
    } else {
      convo.path = path;
      pathToId.set(path, id);
    }
    if (!convo.rawOverride) {
      return convo;
    }
    return convo;
  }

  function pushLine(convo: StoredConversation, item: RolloutItem): void {
    convo.lines.push({ timestamp: new Date().toISOString(), item });
  }

  function buildRecorder(convo: StoredConversation): RolloutRecorder {
    const recordItems = vi.fn(async (items: RolloutItem[]) => {
      recordItemsSpy(items);
      for (const item of items) {
        pushLine(convo, item);
      }
    });

    const appendTurn = vi.fn(async (turn: RolloutTurn) => {
      appendTurnSpy(turn);
      await recordItems([
        {
          type: "turn",
          data: {
            ...turn,
            timestamp: turn.timestamp ?? Date.now(),
          },
        },
      ]);
    });

    const appendCompacted = vi.fn(async (entry: RolloutCompactionEntry) => {
      await recordItems([
        {
          type: "compacted",
          data: {
            ...entry,
            timestamp: entry.timestamp ?? Date.now(),
          },
        },
      ]);
    });

    return {
      getRolloutPath: () => convo.path,
      recordItems,
      appendTurn,
      appendCompacted,
      flush: async () => {},
      shutdown: async () => {},
    } as unknown as RolloutRecorder;
  }

function synthesizeMeta(
  id: string,
  config: Config,
  instructions: string | undefined,
  source: RolloutRecorderParams & { type: "create" }["source"],
): SessionMeta {
  return {
    id,
    timestamp: new Date().toISOString(),
    cwd: config.cwd,
    cliVersion: "mock-cli",
    instructions,
    source,
    modelProvider: config.modelProviderId,
    model: config.model,
    modelProviderApi: config.modelProviderApi,
  };
}

  const store: RolloutStore = {
    async createRecorder(config: Config, params: RolloutRecorderParams) {
      if (params.type === "create") {
        const id = params.conversationId.toString();
        const path = `mock://${id}`;
        const convo = ensureConversation(id, path);
        const meta = synthesizeMeta(id, config, params.instructions, params.source);
        pushLine(convo, { type: "session_meta", data: meta });
        return buildRecorder(convo);
      }

      const path = params.path;
      const id = pathToId.get(path) ?? path.replace("mock://", "");
      const convo = ensureConversation(id, path);
      return buildRecorder(convo);
    },

    async listConversations(_codexHome: string, limit = 50): Promise<ConversationsPage> {
      const items: ConversationItem[] = Array.from(conversations.values()).map(
        (convo) => {
          const metaLine = convo.lines.find((line) => line.item.type === "session_meta");
          const createdAt = convo.lines[0]?.timestamp;
          const updatedAt = convo.lines[convo.lines.length - 1]?.timestamp;
          return {
            path: convo.path,
            id: convo.id,
            meta: metaLine?.item.data as SessionMeta | undefined,
            createdAt,
            updatedAt,
          };
        },
      );
      return {
        items: items.slice(0, limit),
        hasMore: items.length > limit,
      };
    },

    async findConversationPathById(
      _codexHome: string,
      idStr: string,
    ): Promise<string | undefined> {
      const convo = conversations.get(idStr);
      return convo?.path;
    },

    async readConversation(path: string): Promise<RolloutConversation> {
      const id = pathToId.get(path) ?? path.replace("mock://", "");
      const convo = conversations.get(id);
      if (!convo) {
        throw new Error(`Conversation ${id} not found`);
      }
      if (convo.rawOverride) {
        throw new Error("corrupted rollout data");
      }
      const meta = convo.lines.find((line) => line.item.type === "session_meta")?.item
        .data as SessionMeta | undefined;
      const turns = convo.lines
        .filter((line) => line.item.type === "turn")
        .map((line) => line.item.data as RolloutTurn);
      const compacted = convo.lines
        .filter((line) => line.item.type === "compacted")
        .map((line) => line.item.data as RolloutCompactionEntry);
      return { meta, turns, compacted };
    },
  };

  return {
    store,
    recordItemsSpy,
    appendTurnSpy,
    getBuffer(id: string): string {
      const convo = conversations.get(id);
      if (!convo) {
        return "";
      }
      return convo.lines.map(serializeLine).join("\n");
    },
    setBuffer(id: string, contents: string): void {
      const path = `mock://${id}`;
      const convo = ensureConversation(id, path);
      try {
        convo.lines = deserializeLines(contents);
        convo.rawOverride = null;
      } catch (error) {
        convo.rawOverride = contents;
        convo.lines = [];
      }
    },
  };
}
