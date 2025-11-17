import { test as base, expect, type APIRequestContext } from "@playwright/test";

export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async healthCheck() {
    return this.request.get("/health");
  }

  async createConversation(body: {
    modelProviderId: string;
    modelProviderApi: string;
    model: string;
    title?: string;
    summary?: string;
    tags?: string[];
    agentRole?: string;
  }) {
    return this.request.post("/api/v1/conversations", { data: body });
  }

  async listConversations(query?: { cursor?: string; limit?: number }) {
    const params = query
      ? `?${new URLSearchParams(
          Object.entries(query).reduce(
            (acc, [k, v]) => {
              if (v !== undefined) acc[k] = String(v);
              return acc;
            },
            {} as Record<string, string>,
          ),
        )}`
      : "";
    return this.request.get(`/api/v1/conversations${params}`);
  }

  async getConversation(id: string) {
    return this.request.get(`/api/v1/conversations/${id}`);
  }

  async updateConversation(
    id: string,
    body: {
      title?: string;
      summary?: string;
      tags?: string[];
      agentRole?: string;
      modelProviderId?: string;
      modelProviderApi?: string;
      model?: string;
    },
  ) {
    return this.request.patch(`/api/v1/conversations/${id}`, { data: body });
  }

  async deleteConversation(id: string) {
    return this.request.delete(`/api/v1/conversations/${id}`);
  }

  async submitMessage(
    conversationId: string,
    body: {
      message: string;
      modelProviderId?: string;
      modelProviderApi?: string;
      model?: string;
    },
  ) {
    return this.request.post(
      `/api/v1/conversations/${conversationId}/messages`,
      { data: body },
    );
  }

  async getTurnStatus(
    turnId: string,
    query?: { thinkingLevel?: string; toolLevel?: string },
  ) {
    const params = query
      ? `?${new URLSearchParams(
          Object.entries(query).reduce(
            (acc, [k, v]) => {
              if (v !== undefined) acc[k] = String(v);
              return acc;
            },
            {} as Record<string, string>,
          ),
        )}`
      : "";
    return this.request.get(`/api/v1/turns/${turnId}${params}`);
  }

  async streamTurnEvents(
    turnId: string,
    query?: { thinkingLevel?: string; toolLevel?: string },
    headers?: { "Last-Event-ID"?: string },
  ) {
    const params = query
      ? `?${new URLSearchParams(
          Object.entries(query).reduce(
            (acc, [k, v]) => {
              if (v !== undefined) acc[k] = String(v);
              return acc;
            },
            {} as Record<string, string>,
          ),
        )}`
      : "";
    return this.request.get(`/api/v1/turns/${turnId}/stream-events${params}`, {
      headers: headers || {},
    });
  }
}

export const test = base.extend<{ api: ApiClient }>({
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
});

export { expect };
