import { describe, it, expect, beforeEach } from "vitest";
import { CredentialStoreError, MockKeyringStore } from "./index";

describe("CredentialStoreError", () => {
  it("should create error with message", () => {
    const error = new CredentialStoreError("test error");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("test error");
    expect(error.name).toBe("CredentialStoreError");
  });

  it("should be throwable", () => {
    expect(() => {
      throw new CredentialStoreError("test");
    }).toThrow(CredentialStoreError);
  });
});

describe("MockKeyringStore", () => {
  let store: MockKeyringStore;

  beforeEach(() => {
    store = new MockKeyringStore();
  });

  describe("load", () => {
    it("should return None for non-existent credential", async () => {
      const result = await store.load("test-service", "test-account");
      expect(result).toBeUndefined();
    });

    it("should return saved credential", async () => {
      await store.save("test-service", "test-account", "secret-value");
      const result = await store.load("test-service", "test-account");
      expect(result).toBe("secret-value");
    });

    it("should handle multiple accounts", async () => {
      await store.save("test-service", "account1", "value1");
      await store.save("test-service", "account2", "value2");

      const result1 = await store.load("test-service", "account1");
      const result2 = await store.load("test-service", "account2");

      expect(result1).toBe("value1");
      expect(result2).toBe("value2");
    });

    it("should throw error when credential has error set", async () => {
      const error = new CredentialStoreError("simulated error");
      store.setError("test-account", error);

      await expect(store.load("test-service", "test-account")).rejects.toThrow(
        CredentialStoreError,
      );
    });
  });

  describe("save", () => {
    it("should save credential successfully", async () => {
      await expect(
        store.save("test-service", "test-account", "secret-value"),
      ).resolves.toBeUndefined();

      const value = await store.load("test-service", "test-account");
      expect(value).toBe("secret-value");
    });

    it("should overwrite existing credential", async () => {
      await store.save("test-service", "test-account", "old-value");
      await store.save("test-service", "test-account", "new-value");

      const result = await store.load("test-service", "test-account");
      expect(result).toBe("new-value");
    });

    it("should handle empty string values", async () => {
      await store.save("test-service", "test-account", "");
      const result = await store.load("test-service", "test-account");
      expect(result).toBe("");
    });

    it("should throw error when credential has error set", async () => {
      const error = new CredentialStoreError("simulated save error");
      store.setError("test-account", error);

      await expect(
        store.save("test-service", "test-account", "value"),
      ).rejects.toThrow(CredentialStoreError);
    });
  });

  describe("delete", () => {
    it("should return false for non-existent credential", async () => {
      const result = await store.delete("test-service", "non-existent");
      expect(result).toBe(false);
    });

    it("should delete existing credential and return true", async () => {
      await store.save("test-service", "test-account", "secret");

      const deleted = await store.delete("test-service", "test-account");
      expect(deleted).toBe(true);

      const result = await store.load("test-service", "test-account");
      expect(result).toBeUndefined();
    });

    it("should return false when deleting already deleted credential", async () => {
      await store.save("test-service", "test-account", "secret");
      await store.delete("test-service", "test-account");

      const result = await store.delete("test-service", "test-account");
      expect(result).toBe(false);
    });

    it("should throw error when credential has error set", async () => {
      const error = new CredentialStoreError("simulated delete error");
      store.setError("test-account", error);

      await expect(
        store.delete("test-service", "test-account"),
      ).rejects.toThrow(CredentialStoreError);
    });
  });

  describe("helper methods", () => {
    it("savedValue should return undefined for non-existent credential", () => {
      const value = store.savedValue("non-existent");
      expect(value).toBeUndefined();
    });

    it("savedValue should return saved value", async () => {
      await store.save("test-service", "test-account", "secret");
      const value = store.savedValue("test-account");
      expect(value).toBe("secret");
    });

    it("contains should return false for non-existent account", () => {
      expect(store.contains("non-existent")).toBe(false);
    });

    it("contains should return true for existing account", async () => {
      await store.save("test-service", "test-account", "secret");
      expect(store.contains("test-account")).toBe(true);
    });

    it("contains should return false after deletion", async () => {
      await store.save("test-service", "test-account", "secret");
      await store.delete("test-service", "test-account");
      expect(store.contains("test-account")).toBe(false);
    });
  });

  describe("error simulation", () => {
    it("should allow setting error for specific account", () => {
      const error = new CredentialStoreError("test error");
      store.setError("test-account", error);

      // Error should be thrown on next operation
      expect(store.load("test-service", "test-account")).rejects.toThrow();
    });

    it("should only affect the specific account with error", async () => {
      await store.save("test-service", "account1", "value1");
      await store.save("test-service", "account2", "value2");

      const error = new CredentialStoreError("test error");
      store.setError("account1", error);

      // account1 should throw
      await expect(store.load("test-service", "account1")).rejects.toThrow();

      // account2 should work fine
      const result = await store.load("test-service", "account2");
      expect(result).toBe("value2");
    });
  });
});
