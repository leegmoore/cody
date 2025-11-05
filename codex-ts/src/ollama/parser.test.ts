import { describe, it, expect } from 'vitest';
import { pullEventsFromValue, PullEvent } from './parser.js';

describe('pullEventsFromValue', () => {
  it('parses status events', () => {
    const value = { status: 'verifying' };
    const events = pullEventsFromValue(value);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'status', status: 'verifying' });
  });

  it('parses success status with Success event', () => {
    const value = { status: 'success' };
    const events = pullEventsFromValue(value);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'status', status: 'success' });
    expect(events[1]).toEqual({ type: 'success' });
  });

  it('parses chunk progress with total', () => {
    const value = { digest: 'sha256:abc', total: 100 };
    const events = pullEventsFromValue(value);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'chunk_progress',
      digest: 'sha256:abc',
      total: 100,
      completed: undefined
    });
  });

  it('parses chunk progress with completed', () => {
    const value = { digest: 'sha256:def', completed: 42 };
    const events = pullEventsFromValue(value);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'chunk_progress',
      digest: 'sha256:def',
      total: undefined,
      completed: 42
    });
  });

  it('parses chunk progress with both total and completed', () => {
    const value = { digest: 'sha256:xyz', total: 1000, completed: 500 };
    const events = pullEventsFromValue(value);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'chunk_progress',
      digest: 'sha256:xyz',
      total: 1000,
      completed: 500
    });
  });

  it('combines status and progress events', () => {
    const value = {
      status: 'downloading',
      digest: 'sha256:abc',
      total: 100,
      completed: 50
    };
    const events = pullEventsFromValue(value);

    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'status', status: 'downloading' });
    expect(events[1]).toEqual({
      type: 'chunk_progress',
      digest: 'sha256:abc',
      total: 100,
      completed: 50
    });
  });

  it('returns empty array for empty object', () => {
    const value = {};
    const events = pullEventsFromValue(value);
    expect(events).toEqual([]);
  });

  it('handles missing digest in progress', () => {
    const value = { total: 100 };
    const events = pullEventsFromValue(value);

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({
      type: 'chunk_progress',
      digest: '',
      total: 100,
      completed: undefined
    });
  });
});
