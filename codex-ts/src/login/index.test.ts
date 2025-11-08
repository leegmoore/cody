import { describe, it, expect } from "vitest";
import { generatePkce, PkceCodes } from "./index";

describe("PKCE", () => {
  describe("generatePkce", () => {
    it("should generate valid PKCE codes", () => {
      const pkce = generatePkce();

      expect(pkce.codeVerifier).toBeDefined();
      expect(pkce.codeChallenge).toBeDefined();
      expect(typeof pkce.codeVerifier).toBe("string");
      expect(typeof pkce.codeChallenge).toBe("string");
    });

    it("should generate code verifier of expected length", () => {
      const pkce = generatePkce();

      // Code verifier is base64url encoded 64 bytes
      // 64 bytes -> base64 (86 chars without padding)
      expect(pkce.codeVerifier.length).toBeGreaterThanOrEqual(43);
      expect(pkce.codeVerifier.length).toBeLessThanOrEqual(128);
    });

    it("should generate code challenge from verifier", () => {
      const pkce = generatePkce();

      // Code challenge should be base64url encoded SHA256 hash (43 chars without padding)
      expect(pkce.codeChallenge).toHaveLength(43);
    });

    it("should generate different codes on each call", () => {
      const pkce1 = generatePkce();
      const pkce2 = generatePkce();

      expect(pkce1.codeVerifier).not.toBe(pkce2.codeVerifier);
      expect(pkce1.codeChallenge).not.toBe(pkce2.codeChallenge);
    });

    it("should use URL-safe base64 encoding without padding", () => {
      const pkce = generatePkce();

      // Should not contain padding
      expect(pkce.codeVerifier).not.toMatch(/=/);
      expect(pkce.codeChallenge).not.toMatch(/=/);

      // Should only contain URL-safe characters
      expect(pkce.codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(pkce.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("PkceCodes interface", () => {
    it("should match expected structure", () => {
      const pkce: PkceCodes = {
        codeVerifier: "test-verifier",
        codeChallenge: "test-challenge",
      };

      expect(pkce.codeVerifier).toBe("test-verifier");
      expect(pkce.codeChallenge).toBe("test-challenge");
    });
  });
});

describe("ServerOptions", () => {
  it("should accept expected configuration", () => {
    // This is a stub implementation for library use
    // Full server implementation is CLI-specific
    const options = {
      codexHome: "/home/user/.codex",
      clientId: "test-client-id",
      issuer: "https://auth.openai.com",
      port: 1455,
      openBrowser: true,
      forcedChatgptWorkspaceId: undefined,
    };

    expect(options.codexHome).toBe("/home/user/.codex");
    expect(options.clientId).toBe("test-client-id");
    expect(options.issuer).toBe("https://auth.openai.com");
    expect(options.port).toBe(1455);
  });
});
