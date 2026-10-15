import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLastEventId, LAST_EVENT_KEY, mergeEvents, pickDefaultEvent, setLastEventId, sortEvents } from './events';
import type { EventConfig } from '@/types';

const ev = (id: string, updatedAt?: string, createdAt = '2026-01-01T00:00:00.000Z'): EventConfig => ({ id, title: id, createdAt, updatedAt }) as EventConfig;

describe('choosing the first event', () => {
  const a = ev('a', '2026-03-01T00:00:00.000Z');
  const b = ev('b', '2026-05-01T00:00:00.000Z');
  const c = ev('c', undefined, '2026-04-01T00:00:00.000Z');

  it('sorts newest first, using the created date when there is no update', () => {
    expect(sortEvents([a, b, c]).map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });
  it('opens on the event used last, if it still exists', () => {
    expect(pickDefaultEvent([a, b, c], 'a')?.id).toBe('a');
  });
  it('otherwise opens on the newest', () => {
    expect(pickDefaultEvent([a, b, c], 'deleted')?.id).toBe('b');
    expect(pickDefaultEvent([a, b, c], null)?.id).toBe('b');
  });
  it('has nothing to open when there are no events', () => {
    expect(pickDefaultEvent([], 'a')).toBeNull();
  });
  it('does not reorder what it is given', () => {
    const list = [a, b, c];
    pickDefaultEvent(list, null);
    expect(list.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('merging', () => {
  it('lists each event once, prefers the database copy, and keeps events only on this device', () => {
    const remote = [{ ...ev('x', '2026-06-01T00:00:00.000Z'), title: 'From database' } as EventConfig];
    const local = [{ ...ev('x', '2026-02-01T00:00:00.000Z'), title: 'Old local' } as EventConfig, ev('y', '2026-07-01T00:00:00.000Z')];
    const merged = mergeEvents(remote, local);
    expect(merged.map((e) => e.id)).toEqual(['y', 'x']);
    expect(merged.find((e) => e.id === 'x')?.title).toBe('From database');
  });
});

describe('remembering the last event', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) });
  });
  it('saves and reads it back', () => {
    expect(getLastEventId()).toBeNull();
    setLastEventId('evt_1');
    expect(getLastEventId()).toBe('evt_1');
    expect(localStorage.getItem(LAST_EVENT_KEY)).toBe('evt_1');
  });
  it('copes with storage that throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } });
    expect(getLastEventId()).toBeNull();
    expect(() => setLastEventId('x')).not.toThrow();
  });
});
