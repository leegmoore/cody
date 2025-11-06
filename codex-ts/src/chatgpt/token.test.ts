import { describe, test, expect, beforeEach } from "vitest";
import {
  getChatGptTokenData,
  setChatGptTokenData,
  clearChatGptTokenData,
} from "./token";

describe("ChatGPT Token Management", () => {
  beforeEach(() => {
    // Clear token before each test
    clearChatGptTokenData();
  });

  test("get token returns undefined initially", () => {
    const token = getChatGptTokenData();
    expect(token).toBeUndefined();
  });

  test("set and get token", () => {
    const tokenData = {
      accessToken: "test-access-token",
      accountId: "test-account-id",
    };

    setChatGptTokenData(tokenData);
    const retrieved = getChatGptTokenData();

    expect(retrieved).toEqual(tokenData);
  });

  test("set token overwrites previous token", () => {
    const token1 = {
      accessToken: "token-1",
      accountId: "account-1",
    };
    const token2 = {
      accessToken: "token-2",
      accountId: "account-2",
    };

    setChatGptTokenData(token1);
    setChatGptTokenData(token2);

    const retrieved = getChatGptTokenData();
    expect(retrieved).toEqual(token2);
  });

  test("clear token removes stored token", () => {
    const tokenData = {
      accessToken: "test-token",
      accountId: "test-account",
    };

    setChatGptTokenData(tokenData);
    clearChatGptTokenData();

    const retrieved = getChatGptTokenData();
    expect(retrieved).toBeUndefined();
  });
});
