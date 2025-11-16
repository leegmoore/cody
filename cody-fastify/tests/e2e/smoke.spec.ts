import { test, expect } from "./fixtures/api-client";

test.describe("Health Check", () => {
  test("should return 200 with valid response", async ({ api }) => {
    const response = await api.healthCheck();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeTruthy();
    expect(data.version).toBe("0.1.0");
  });
});
