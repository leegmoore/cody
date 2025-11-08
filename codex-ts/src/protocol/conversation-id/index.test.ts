import { describe, it, expect } from "vitest";
import { ConversationId } from "./index.js";

describe("ConversationId", () => {
  it("creates a new conversation ID", () => {
    const id = new ConversationId();
    expect(id.toString()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("default is not all zeroes", () => {
    const id = ConversationId.default();
    expect(id.toString()).not.toBe("00000000-0000-0000-0000-000000000000");
  });

  it("creates from valid UUID string", () => {
    const uuidStr = "550e8400-e29b-41d4-a716-446655440000";
    const id = ConversationId.fromString(uuidStr);

    expect(id.toString()).toBe(uuidStr);
  });

  it("throws on invalid UUID string", () => {
    expect(() => ConversationId.fromString("invalid")).toThrow();
  });

  it("serializes to JSON as string", () => {
    const id = ConversationId.fromString(
      "550e8400-e29b-41d4-a716-446655440000",
    );
    const json = JSON.stringify({ id });

    expect(json).toBe('{"id":"550e8400-e29b-41d4-a716-446655440000"}');
  });

  it("deserializes from JSON string", () => {
    const json = '{"id":"550e8400-e29b-41d4-a716-446655440000"}';
    const obj = JSON.parse(json) as { id: string };
    const id = ConversationId.fromString(obj.id);

    expect(id.toString()).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("two different IDs are not equal", () => {
    const id1 = new ConversationId();
    const id2 = new ConversationId();

    expect(id1.toString()).not.toBe(id2.toString());
  });

  it("same ID strings create equal IDs", () => {
    const uuidStr = "550e8400-e29b-41d4-a716-446655440000";
    const id1 = ConversationId.fromString(uuidStr);
    const id2 = ConversationId.fromString(uuidStr);

    expect(id1.toString()).toBe(id2.toString());
  });
});
