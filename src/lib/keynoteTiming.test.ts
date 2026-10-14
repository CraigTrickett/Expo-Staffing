import { describe, it, expect } from 'vitest';
import {
  scheduleSegments,
  sessionWindowMinutes,
  totalSegmentMinutes,
  timingStatus,
  moveSegment,
  resolveSegmentTeams,
} from './keynote';
import type { KeyStakeholder, RunOfShowSegment } from '@/types';

const seg = (id: string, durationMinutes: number, extra: Partial<RunOfShowSegment> = {}): RunOfShowSegment => ({
  id,
  order: 0,
  time: '',
  durationMinutes,
  topic: id,
  speakerIds: [],
  speakerNames: '',
  ...extra,
});

const person = (id: string, firstName: string, lastName: string, team: string): KeyStakeholder => ({
  id,
  eventId: 'evt',
  firstName,
  lastName,
  email: `${firstName.toLowerCase()}@example.com`,
  team,
  involvedWith: [],
  createdAt: '2026-01-01T00:00:00.000Z',
});

describe('scheduleSegments', () => {
  it('chains start times from the session start and numbers the rows', () => {
    const out = scheduleSegments('09:00', [seg('a', 5), seg('b', 25), seg('c', 20)]);
    expect(out.map((s) => s.time)).toEqual(['09:00 - 09:05', '09:05 - 09:30', '09:30 - 09:50']);
    expect(out.map((s) => s.order)).toEqual([1, 2, 3]);
  });

  it('reflows when the order changes, which is what drag reordering relies on', () => {
    const before = [seg('a', 5), seg('b', 25)];
    const after = scheduleSegments('09:00', moveSegment(before, 1, 0));
    expect(after.map((s) => s.id)).toEqual(['b', 'a']);
    expect(after[0].time).toBe('09:00 - 09:25');
    expect(after[1].time).toBe('09:25 - 09:30');
  });

  it('does not mutate its input', () => {
    const input = [seg('a', 5)];
    scheduleSegments('09:00', input);
    expect(input[0].time).toBe('');
  });

  it('falls back to 5 minutes for a zero duration, matching the existing recalculation', () => {
    expect(scheduleSegments('09:00', [seg('a', 0)])[0].time).toBe('09:00 - 09:05');
  });
});

describe('session window and timing status', () => {
  it('measures the window', () => {
    expect(sessionWindowMinutes('09:00', '10:30')).toBe(90);
  });

  it('treats an end before the start as running past midnight', () => {
    expect(sessionWindowMinutes('23:30', '00:30')).toBe(60);
  });

  it('totals durations', () => {
    expect(totalSegmentMinutes([seg('a', 5), seg('b', 25)])).toBe(30);
  });

  it('reports over, spare and exact', () => {
    expect(timingStatus(100, 90)).toEqual({ kind: 'over', minutes: 10 });
    expect(timingStatus(80, 90)).toEqual({ kind: 'spare', minutes: 10 });
    expect(timingStatus(90, 90)).toEqual({ kind: 'exact', minutes: 0 });
  });
});

describe('moveSegment', () => {
  const list = [seg('a', 5), seg('b', 5), seg('c', 5)];

  it('moves forwards and backwards', () => {
    expect(moveSegment(list, 0, 2).map((s) => s.id)).toEqual(['b', 'c', 'a']);
    expect(moveSegment(list, 2, 0).map((s) => s.id)).toEqual(['c', 'a', 'b']);
  });

  it('returns the same array for a no-op or out-of-range move', () => {
    expect(moveSegment(list, 1, 1)).toBe(list);
    expect(moveSegment(list, -1, 1)).toBe(list);
    expect(moveSegment(list, 0, 3)).toBe(list);
  });

  it('does not mutate the original', () => {
    moveSegment(list, 0, 2);
    expect(list.map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('resolveSegmentTeams', () => {
  const people = [
    person('stk_sarah', 'Sarah', 'Chen', 'Executive Office'),
    person('stk_marcus', 'Marcus', 'Vance', 'Platform Engineering'),
    person('stk_craig', 'Craig', 'Trickett', 'Developer Advocacy'),
    person('stk_priya', 'Priya', 'Nair', 'Executive Office'),
  ];

  it('uses the linked stakeholder', () => {
    expect(resolveSegmentTeams(seg('a', 5, { speakerIds: ['stk_marcus'] }), people)).toEqual(['Platform Engineering']);
  });

  it('collapses repeated teams and keeps speaker order', () => {
    const s = seg('a', 5, { speakerIds: ['stk_sarah', 'stk_marcus', 'stk_priya'] });
    expect(resolveSegmentTeams(s, people)).toEqual(['Executive Office', 'Platform Engineering']);
  });

  it('resolves free-text names that match a stakeholder', () => {
    const s = seg('a', 5, { speakerNames: 'Craig Trickett & Sarah Chen' });
    expect(resolveSegmentTeams(s, people)).toEqual(['Developer Advocacy', 'Executive Office']);
  });

  it('ignores role suffixes in parentheses and is case-insensitive', () => {
    const s = seg('a', 5, { speakerNames: 'craig  trickett (MC)' });
    expect(resolveSegmentTeams(s, people)).toEqual(['Developer Advocacy']);
  });

  it('returns nothing for guests who are not stakeholders', () => {
    expect(resolveSegmentTeams(seg('a', 5, { speakerNames: 'Acme Infrastructure Co-Presenter' }), people)).toEqual([]);
    expect(resolveSegmentTeams(seg('a', 5), people)).toEqual([]);
  });

  it('prefers linked ids over names', () => {
    const s = seg('a', 5, { speakerIds: ['stk_marcus'], speakerNames: 'Sarah Chen' });
    expect(resolveSegmentTeams(s, people)).toEqual(['Platform Engineering']);
  });

  it('skips a stale id and falls back to the name', () => {
    const s = seg('a', 5, { speakerIds: ['stk_deleted'], speakerNames: 'Marcus Vance' });
    expect(resolveSegmentTeams(s, people)).toEqual(['Platform Engineering']);
  });
});
