import { test as base, expect, type APIRequestContext } from "@playwright/test";

export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  async healthCheck() {
    return this.request.get("/health");
  }
}

export const test = base.extend<{ api: ApiClient }>({
  api: async ({ request }, use) => {
    await use(new ApiClient(request));
  },
});

export { expect };
