import { describe, it, expect } from "vitest";
import { parseTomlValue, CliConfigOverrides } from "./config-override.js";

describe("parseTomlValue", () => {
  it("parses basic scalar", () => {
    const v = parseTomlValue("42");
    expect(v).toBe(42);
  });

  it("fails on unquoted string", () => {
    expect(() => parseTomlValue("hello")).toThrow();
  });

  it("parses array", () => {
    const v = parseTomlValue("[1, 2, 3]");
    expect(Array.isArray(v)).toBe(true);
    expect((v as number[]).length).toBe(3);
  });

  it("parses inline table", () => {
    const v = parseTomlValue("{a = 1, b = 2}");
    expect(typeof v).toBe("object");
    const obj = v as Record<string, number>;
    expect(obj.a).toBe(1);
    expect(obj.b).toBe(2);
  });

  it("parses quoted string", () => {
    const v = parseTomlValue('"hello world"');
    expect(v).toBe("hello world");
  });

  it("parses boolean", () => {
    const v1 = parseTomlValue("true");
    expect(v1).toBe(true);
    const v2 = parseTomlValue("false");
    expect(v2).toBe(false);
  });
});

describe("CliConfigOverrides", () => {
  it("parses simple key=value override", () => {
    const overrides = new CliConfigOverrides(["model=o3"]);
    const parsed = overrides.parseOverrides();
    expect(parsed.length).toBe(1);
    expect(parsed[0][0]).toBe("model");
    expect(parsed[0][1]).toBe("o3");
  });

  it("parses key=value with JSON value", () => {
    const overrides = new CliConfigOverrides(["count=42"]);
    const parsed = overrides.parseOverrides();
    expect(parsed.length).toBe(1);
    expect(parsed[0][0]).toBe("count");
    expect(parsed[0][1]).toBe(42);
  });

  it("parses key=value with array", () => {
    const overrides = new CliConfigOverrides(["items=[1, 2, 3]"]);
    const parsed = overrides.parseOverrides();
    expect(parsed.length).toBe(1);
    expect(parsed[0][0]).toBe("items");
    expect(Array.isArray(parsed[0][1])).toBe(true);
  });

  it("handles multiple overrides", () => {
    const overrides = new CliConfigOverrides(["key1=value1", "key2=42"]);
    const parsed = overrides.parseOverrides();
    expect(parsed.length).toBe(2);
    expect(parsed[0][0]).toBe("key1");
    expect(parsed[0][1]).toBe("value1");
    expect(parsed[1][0]).toBe("key2");
    expect(parsed[1][1]).toBe(42);
  });

  it("handles dotted paths", () => {
    const overrides = new CliConfigOverrides(["foo.bar.baz=test"]);
    const parsed = overrides.parseOverrides();
    expect(parsed[0][0]).toBe("foo.bar.baz");
    expect(parsed[0][1]).toBe("test");
  });

  it("applies override to empty object", () => {
    const overrides = new CliConfigOverrides(["model=o3"]);
    const target: any = {};
    overrides.applyOnValue(target);
    expect(target.model).toBe("o3");
  });

  it("applies nested override", () => {
    const overrides = new CliConfigOverrides(["foo.bar=42"]);
    const target: any = {};
    overrides.applyOnValue(target);
    expect(target.foo.bar).toBe(42);
  });

  it("replaces existing value", () => {
    const overrides = new CliConfigOverrides(["model=new-model"]);
    const target: any = { model: "old-model" };
    overrides.applyOnValue(target);
    expect(target.model).toBe("new-model");
  });

  it("creates intermediate objects", () => {
    const overrides = new CliConfigOverrides(["a.b.c.d=value"]);
    const target: any = {};
    overrides.applyOnValue(target);
    expect(target.a.b.c.d).toBe("value");
  });

  it("handles value containing equals sign", () => {
    const overrides = new CliConfigOverrides([
      'url="https://example.com?a=1&b=2"',
    ]);
    const parsed = overrides.parseOverrides();
    expect(parsed[0][0]).toBe("url");
    expect(parsed[0][1]).toBe("https://example.com?a=1&b=2");
  });

  it("throws on missing equals sign", () => {
    const overrides = new CliConfigOverrides(["invalidoverride"]);
    expect(() => overrides.parseOverrides()).toThrow("missing '='");
  });

  it("throws on empty key", () => {
    const overrides = new CliConfigOverrides(["=value"]);
    expect(() => overrides.parseOverrides()).toThrow("Empty key");
  });
});
