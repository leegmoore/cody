import { describe, it, expect } from "vitest";
import {
  INVALID_REQUEST_ERROR_CODE,
  INTERNAL_ERROR_CODE,
  CHANNEL_CAPACITY,
} from "./index";

describe("Error Codes", () => {
  it("should define INVALID_REQUEST_ERROR_CODE", () => {
    expect(INVALID_REQUEST_ERROR_CODE).toBe(-32600);
  });

  it("should define INTERNAL_ERROR_CODE", () => {
    expect(INTERNAL_ERROR_CODE).toBe(-32603);
  });
});

describe("Constants", () => {
  it("should define CHANNEL_CAPACITY", () => {
    expect(CHANNEL_CAPACITY).toBe(128);
  });
});
