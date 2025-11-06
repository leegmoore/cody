import { describe, test, expect } from "vitest";
import {
  RmcpClient,
  OAuthCredentialsStoreMode,
  supportsOAuthLogin,
  determineStreamableHttpAuthStatus,
} from "./client";

describe("RmcpClient (stub)", () => {
  test("create client with server name", () => {
    const client = new RmcpClient("test-server");
    expect(client.getServerName()).toBe("test-server");
  });

  test("connect throws not implemented", async () => {
    const client = new RmcpClient("test-server");
    await expect(client.connect()).rejects.toThrow(
      "not implemented - deferred to Phase 5",
    );
  });

  test("disconnect throws not implemented", async () => {
    const client = new RmcpClient("test-server");
    await expect(client.disconnect()).rejects.toThrow(
      "not implemented - deferred to Phase 5",
    );
  });

  test("supportsOAuthLogin returns false (stub)", () => {
    const result = supportsOAuthLogin({});
    expect(result).toBe(false);
  });

  test("determineStreamableHttpAuthStatus returns unsupported (stub)", async () => {
    const status = await determineStreamableHttpAuthStatus(
      "test-server",
      "https://example.com",
      undefined,
      undefined,
      undefined,
      OAuthCredentialsStoreMode.Keyring,
    );
    expect(status).toBe("unsupported");
  });
});
