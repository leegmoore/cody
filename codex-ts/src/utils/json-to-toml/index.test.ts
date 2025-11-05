import { describe, it, expect } from 'vitest';
import { jsonToToml } from './index.js';

describe('jsonToToml', () => {
  it('converts JSON number to TOML integer', () => {
    const json = 123;
    const result = jsonToToml(json);
    expect(result).toBe(123);
  });

  it('converts JSON array to TOML array', () => {
    const json = [true, 1];
    const result = jsonToToml(json);
    expect(result).toEqual([true, 1]);
  });

  it('converts JSON boolean to TOML boolean', () => {
    const json = false;
    const result = jsonToToml(json);
    expect(result).toBe(false);
  });

  it('converts JSON float to TOML float', () => {
    const json = 1.25;
    const result = jsonToToml(json);
    expect(result).toBe(1.25);
  });

  it('converts JSON null to empty TOML string', () => {
    const json = null;
    const result = jsonToToml(json);
    expect(result).toBe('');
  });

  it('converts JSON string to TOML string', () => {
    const json = 'hello';
    const result = jsonToToml(json);
    expect(result).toBe('hello');
  });

  it('converts nested JSON object to TOML table', () => {
    const json = { outer: { inner: 2 } };
    const result = jsonToToml(json);

    expect(result).toEqual({
      outer: {
        inner: 2
      }
    });
  });

  it('converts complex nested structure', () => {
    const json = {
      name: 'test',
      values: [1, 2, 3],
      nested: {
        flag: true,
        value: 42.5
      }
    };

    const result = jsonToToml(json);

    expect(result).toEqual({
      name: 'test',
      values: [1, 2, 3],
      nested: {
        flag: true,
        value: 42.5
      }
    });
  });

  it('handles arrays with mixed types', () => {
    const json = [1, 'two', true, null];
    const result = jsonToToml(json);
    expect(result).toEqual([1, 'two', true, '']);
  });
});
