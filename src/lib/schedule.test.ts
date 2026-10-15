import { describe, it, expect } from 'vitest';
import {
  addCombination, addLayout, addRoom, analyseSchedule, assignSpace, createEmptySchedule, createSession,
  defaultSpaceName, findRoomClash, fromMinutes, getSpace, isContiguous, keynoteBlocks, layoutsFor, listSpaces,
  moveRoom, normaliseSchedule, nudgeSession, placeSession, removeCombination, removeLayout, removeRoom,
  renameRoom, resizeSession, scheduleSummary, sessionWarnings,
  addBlock, allTags, blocksFor, cleanTags, copyBlocks, dayLayoutId, dayWindow, effectiveLayoutId, fillSlots, openStretches, removeBlock,
  sessionLabel, setDayLayout, setLayoutForAllDays, snapStart, timeProblem, updateBlock, setCapacity, toMinutes, unplaceSession, updateSession,
} from './schedule';
import type { ScheduleContext } from './schedule';
import type { ScheduleData } from '@/types/schedule';
import type { KeynoteSession } from '@/types';

const must = <T>(r: { ok: boolean; data?: T; error?: string }): T => {
  if (r.ok !== true) throw new Error(`expected ok, got: ${r.error}`);
  return r.data as T;
};
const err = (r: { ok: boolean; error?: string }): string => {
  if (r.ok !== false) throw new Error('expected a failure');
  return r.error as string;
};

const NO_CTX: ScheduleContext = { keynotes: [] };
const DAY = '2026-11-09';

/** Three Murano rooms, joined as 3202+3203 and 3202+3203+3204. */
function venue(): ScheduleData {
  let d = createEmptySchedule();
  for (const n of ['Murano 3202', 'Murano 3203', 'Murano 3204']) d = must(addRoom(d, n));
  const [a, b, c] = d.rooms.map((r) => r.id);
  d = must(addCombination(d, [a, b]));
  d = must(addCombination(d, [a, b, c]));
  const theatre = 'layout_theatre';
  const classroom = 'layout_classroom';
  d = must(setCapacity(d, a, theatre, 60));
  d = must(setCapacity(d, a, classroom, 30));
  d = must(setCapacity(d, b, theatre, 60));
  d = must(setCapacity(d, c, theatre, 40));
  d = must(setCapacity(d, d.combinations[0].id, theatre, 140));
  d = must(setCapacity(d, d.combinations[1].id, theatre, 220));
  return d;
}

function withSession(d: ScheduleData, input: Parameters<typeof createSession>[0]): [ScheduleData, string] {
  const s = must(createSession(input));
  return [{ ...d, sessions: [...d.sessions, s] }, s.id];
}

describe('space names', () => {
  it('shares the common start of the room names, as the Developer Summit document does', () => {
    expect(defaultSpaceName(['Murano 3202', 'Murano 3203', 'Murano 3204'])).toBe('Murano 3202, 3203, 3204');
    expect(defaultSpaceName(['Salon A', 'Salon B'])).toBe('Salon A, B');
  });
  it('falls back to a plain list when there is nothing in common, or a name would be left empty', () => {
    expect(defaultSpaceName(['Ballroom', 'Foyer'])).toBe('Ballroom, Foyer');
    expect(defaultSpaceName(['Hall 1', 'Hall 1 Foyer'])).toBe('Hall 1, Hall 1 Foyer');
    expect(defaultSpaceName(['Solo'])).toBe('Solo');
  });
  it('lists rooms and combinations as spaces, and a custom name wins', () => {
    let d = venue();
    expect(listSpaces(d).map((s) => s.name)).toEqual(['Murano 3202', 'Murano 3203', 'Murano 3204', 'Murano 3202, 3203', 'Murano 3202, 3203, 3204']);
    d = { ...d, combinations: d.combinations.map((c, i) => (i === 1 ? { ...c, name: 'Grand Hall' } : c)) };
    expect(listSpaces(d).at(-1)?.name).toBe('Grand Hall');
  });
});

describe('rooms, layouts and combinations', () => {
  it('rejects a blank or duplicate room, case-insensitively', () => {
    const d = venue();
    expect(err(addRoom(d, '  '))).toMatch(/name/);
    expect(err(addRoom(d, 'murano 3202'))).toMatch(/already a room/);
    expect(err(renameRoom(d, d.rooms[1].id, 'MURANO 3202'))).toMatch(/already a room/);
    expect(must(renameRoom(d, d.rooms[1].id, 'Murano 3203'))).toBeTruthy();
  });

  it('only joins neighbouring rooms, at least two, once', () => {
    const d = venue();
    const [a, , c] = d.rooms.map((r) => r.id);
    expect(err(addCombination(d, [a, c]))).toMatch(/next to each other/);
    expect(err(addCombination(d, [a]))).toMatch(/at least two/);
    expect(err(addCombination(d, [d.rooms[1].id, a]))).toMatch(/already joined/);
    expect(isContiguous(d, [c, d.rooms[1].id])).toBe(true);
    expect(isContiguous(d, [a, c])).toBe(false);
  });

  it('keeps member rooms in room order whichever order they were chosen', () => {
    let d = createEmptySchedule();
    for (const n of ['A', 'B', 'C']) d = must(addRoom(d, n));
    const [a, b, c] = d.rooms.map((r) => r.id);
    d = must(addCombination(d, [c, b, a]));
    expect(d.combinations[0].roomIds).toEqual([a, b, c]);
  });

  it('will not move a room if that would split a joined set', () => {
    const d = venue();
    // swapping 3202 and 3203 keeps both joined sets contiguous, so it is allowed
    expect(moveRoom(d, d.rooms[0].id, 1).ok).toBe(true);
    // moving 3204 up would put it between 3202 and 3203, splitting the pair
    expect(err(moveRoom(d, d.rooms[2].id, -1))).toMatch(/split Murano 3202, 3203/);
    expect(moveRoom(d, d.rooms[0].id, -1).ok).toBe(true); // already first: no change
  });

  it('will not remove a room that is joined, or has sessions, or a keynote', () => {
    let d = venue();
    const [a, , c] = d.rooms.map((r) => r.id);
    expect(err(removeRoom(d, a))).toMatch(/Remove that combination first/);
    d = must(removeCombination(d, d.combinations[1].id));
    d = must(removeCombination(d, d.combinations[0].id));
    const [d2, id] = withSession(d, { title: 'Talk', spaceId: c });
    expect(err(removeRoom(d2, c))).toMatch(/1 session/);
    expect(err(removeRoom(d, c, [c]))).toMatch(/1 keynote/);
    expect(must(removeRoom(updateSession(d2, id, { spaceId: undefined }), c)).rooms).toHaveLength(2);
  });

  it('will not remove a combination that is in use', () => {
    const d = venue();
    const combo = d.combinations[0].id;
    const [d2] = withSession(d, { title: 'Big talk', spaceId: combo });
    expect(err(removeCombination(d2, combo))).toMatch(/1 session/);
  });

  it('offers only the layouts a space has a capacity for, in layout order', () => {
    const d = venue();
    expect(layoutsFor(d, d.rooms[0].id).map((l) => [l.layout.name, l.capacity])).toEqual([['Theatre', 60], ['Classroom', 30]]);
    expect(layoutsFor(d, d.rooms[2].id).map((l) => l.layout.name)).toEqual(['Theatre']);
    expect(layoutsFor(d, 'nope')).toEqual([]);
  });

  it('a joined room has its own capacity, not the sum of its parts', () => {
    const d = venue();
    expect(getSpace(d, d.combinations[0].id)?.capacities.layout_theatre).toBe(140);
  });

  it('sets, validates and removes capacities; will not drop a layout a session uses', () => {
    const d = venue();
    const a = d.rooms[0].id;
    expect(err(setCapacity(d, a, 'layout_theatre', 0))).toMatch(/whole number/);
    expect(err(setCapacity(d, a, 'layout_theatre', 12.5))).toMatch(/whole number/);
    expect(err(setCapacity(d, 'nope', 'layout_theatre', 5))).toMatch(/no longer exists/);
    const [d2] = withSession(d, { title: 'Talk', spaceId: a, layoutId: 'layout_classroom' });
    expect(err(setCapacity(d2, a, 'layout_classroom', null))).toMatch(/uses that layout/);
    expect(layoutsFor(must(setCapacity(d, a, 'layout_classroom', null)), a).map((l) => l.layout.name)).toEqual(['Theatre']);
  });

  it('adds layouts uniquely and will not remove one in use', () => {
    const d = venue();
    expect(err(addLayout(d, 'theatre'))).toMatch(/already a layout/);
    const d2 = must(addLayout(d, 'Banquet'));
    expect(d2.layouts.at(-1)?.id).toBe('layout_banquet');
    expect(err(removeLayout(d, 'layout_theatre'))).toMatch(/offered by a room/);
    expect(must(removeLayout(d2, 'layout_banquet')).layouts.length).toBe(d.layouts.length);
  });
});

describe('sessions', () => {
  it('needs a title, refuses an unsafe presentation link, and keeps duration sensible', () => {
    expect(err(createSession({ title: '  ' }))).toMatch(/title/);
    expect(err(createSession({ title: 'x', presentationUrl: 'javascript:alert(1)' }))).toMatch(/http/);
    const s = must(createSession({ title: ' Hello ', presentationUrl: 'docs.google.com/presentation/d/x', durationMinutes: 9999 }));
    expect(s).toMatchObject({ title: 'Hello', presentationUrl: 'https://docs.google.com/presentation/d/x', durationMinutes: 480 });
    expect(must(createSession({ title: 'x', durationMinutes: 1 })).durationMinutes).toBe(5);
    expect(must(createSession({ title: 'x' })).durationMinutes).toBe(45);
  });
});

describe('placing a session', () => {
  const put = (d: ScheduleData, id: string, spaceId: string, startTime: string, ctx = NO_CTX, layoutId?: string) =>
    placeSession(d, ctx, id, { spaceId, date: DAY, startTime, layoutId });

  it('places a session and snaps nothing silently: the time is kept as given', () => {
    const d = venue();
    const [d2, id] = withSession(d, { title: 'Talk', durationMinutes: 45, spaceId: d.rooms[0].id });
    const placed = must(put(d2, id, d.rooms[0].id, '09:30'));
    expect(placed.data.sessions[0]).toMatchObject({ date: DAY, startTime: '09:30', spaceId: d.rooms[0].id });
    expect(placed.warnings).toEqual([]);
  });

  it('keeps sessions inside the day\'s hours', () => {
    const d = venue();
    const [d2, id] = withSession(d, { title: 'Talk', durationMinutes: 60 });
    expect(err(put(d2, id, d.rooms[0].id, '07:45'))).toMatch(/outside the day's hours \(08:00 to 18:00\)/);
    expect(err(put(d2, id, d.rooms[0].id, '17:30'))).toMatch(/outside the day's hours/);
    expect(put(d2, id, d.rooms[0].id, '17:00').ok).toBe(true); // ends exactly at 18:00
    expect(err(put(d2, id, d.rooms[0].id, 'late'))).toMatch(/start time/);
  });

  it('blocks a double-booked room, but allows back-to-back', () => {
    let d = venue();
    const a = d.rooms[0].id;
    let first: string, second: string;
    [d, first] = withSession(d, { title: 'First', durationMinutes: 60 });
    [d, second] = withSession(d, { title: 'Second', durationMinutes: 60 });
    d = must(put(d, first, a, '10:00')).data;
    expect(err(put(d, second, a, '10:30'))).toMatch(/Murano 3202 is already booked 10:00 to 11:00 for "First"/);
    expect(err(put(d, second, a, '09:30'))).toMatch(/already booked/);
    expect(put(d, second, a, '11:00').ok).toBe(true);
    expect(put(d, second, a, '09:00').ok).toBe(true);
    expect(put(d, second, d.rooms[1].id, '10:00').ok).toBe(true); // another room is free
  });

  it('lets a session be moved within the time it already occupies', () => {
    let d = venue();
    const a = d.rooms[0].id;
    let id: string;
    [d, id] = withSession(d, { title: 'Only', durationMinutes: 60 });
    d = must(put(d, id, a, '10:00')).data;
    expect(put(d, id, a, '10:15').ok).toBe(true);
  });

  it('a joined room blocks every room in it, and each room blocks the joined room', () => {
    let d = venue();
    const [a, b, c] = d.rooms.map((r) => r.id);
    const [pair, trio] = d.combinations.map((x) => x.id);
    let big: string, small: string;
    [d, big] = withSession(d, { title: 'Big', durationMinutes: 60 });
    [d, small] = withSession(d, { title: 'Small', durationMinutes: 60 });
    d = must(put(d, big, pair, '10:00')).data;
    expect(err(put(d, small, a, '10:00'))).toMatch(/Murano 3202 is already booked/);
    expect(err(put(d, small, b, '10:30'))).toMatch(/Murano 3203 is already booked/);
    expect(put(d, small, c, '10:00').ok).toBe(true); // 3204 is outside the pair
    expect(err(put(d, small, trio, '10:00'))).toMatch(/Murano 3202 and Murano 3203 is already booked/);

    // and the other way round: a small session blocks the joined room above it
    let d2 = venue();
    const c2 = d2.rooms[2].id;
    [d2, small] = withSession(d2, { title: 'Small', durationMinutes: 60 });
    [d2, big] = withSession(d2, { title: 'Big', durationMinutes: 60 });
    d2 = must(put(d2, small, c2, '10:00')).data;
    expect(err(put(d2, big, d2.combinations[1].id, '10:00'))).toMatch(/Murano 3204 is already booked/);
    expect(put(d2, big, d2.combinations[0].id, '10:00').ok).toBe(true); // the pair does not include 3204
  });

  it('only clashes on the same day', () => {
    let d = venue();
    const a = d.rooms[0].id;
    let x: string, y: string;
    [d, x] = withSession(d, { title: 'X', durationMinutes: 60 });
    [d, y] = withSession(d, { title: 'Y', durationMinutes: 60 });
    d = must(put(d, x, a, '10:00')).data;
    expect(placeSession(d, NO_CTX, y, { spaceId: a, date: '2026-11-10', startTime: '10:00' }).ok).toBe(true);
  });

  it('only allows the days of the event when told them', () => {
    const d = venue();
    const [d2, id] = withSession(d, { title: 'Talk' });
    expect(err(placeSession(d2, { keynotes: [], eventDates: ['2026-11-09'] }, id, { spaceId: d.rooms[0].id, date: '2026-11-20', startTime: '10:00' }))).toMatch(/outside the event/);
  });

  it('clears a layout the new room does not offer, and says so', () => {
    const d = venue();
    const [d2, id] = withSession(d, { title: 'Talk', spaceId: d.rooms[0].id, layoutId: 'layout_classroom' });
    const r = must(put(d2, id, d.rooms[2].id, '10:00')); // 3204 has only Theatre
    expect(r.data.sessions[0].layoutId).toBeUndefined();
    expect(r.warnings[0]).toMatchObject({ kind: 'layout' });
    expect(r.warnings[0].message).toMatch(/Murano 3204 does not offer Classroom/);
  });

  it('warns, but allows, when the room is too small for the expected attendance', () => {
    const d = venue();
    const [d2, id] = withSession(d, { title: 'Talk', expectedAttendance: 70 });
    const r = must(put(d2, id, d.rooms[0].id, '10:00', NO_CTX, 'layout_theatre'));
    expect(r.warnings).toEqual([{ kind: 'capacity', message: 'Expects 70 people but the room seats 60 in Theatre.' }]);
    expect(must(put(d2, id, d.combinations[0].id, '10:00', NO_CTX, 'layout_theatre')).warnings).toEqual([]);
  });

  it('warns, but allows, when a speaker is in two places', () => {
    let d = venue();
    const sarah = { id: 'stk_sarah', name: 'Sarah Chen' };
    let a: string, b: string;
    [d, a] = withSession(d, { title: 'Morning talk', durationMinutes: 60, speakers: [sarah] });
    [d, b] = withSession(d, { title: 'Parallel talk', durationMinutes: 60, speakers: [sarah] });
    d = must(put(d, a, d.rooms[0].id, '10:00')).data;
    const r = must(put(d, b, d.rooms[1].id, '10:30'));
    expect(r.warnings).toEqual([{ kind: 'speaker', message: 'Sarah Chen is also in "Morning talk", 10:00 to 11:00.' }]);
    expect(must(put(d, b, d.rooms[1].id, '11:00')).warnings).toEqual([]);
  });
});

describe('keynotes in rooms', () => {
  const ks = (over: Partial<KeynoteSession> = {}): KeynoteSession =>
    ({
      id: 'kn1', title: 'Opening Keynote', date: DAY, startTime: '09:00', endTime: '10:00', spaceId: 'x',
      segments: [
        { id: 's1', order: 1, time: '09:00 - 09:10', durationMinutes: 10, topic: 'Welcome', speakerIds: ['stk_chris'], speakerNames: '' },
        { id: 's2', order: 2, time: '09:10 - 09:40', durationMinutes: 30, topic: 'Main', speakerIds: ['stk_sarah'], speakerNames: '' },
      ],
      ...over,
    }) as unknown as KeynoteSession;
  const people = [
    { id: 'stk_chris', firstName: 'Chris', lastName: 'Peppler' },
    { id: 'stk_sarah', firstName: 'Sarah', lastName: 'Chen' },
  ] as never;

  it('turns a keynote with a room into a block, with when each speaker is on stage', () => {
    const d = venue();
    const blocks = keynoteBlocks([ks({ spaceId: d.combinations[1].id }), ks({ id: 'no-room', spaceId: undefined })], people);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].speakerWindows).toEqual([
      { speakerId: 'stk_chris', speakerName: 'Chris Peppler', start: '09:00', end: '09:10' },
      { speakerId: 'stk_sarah', speakerName: 'Sarah Chen', start: '09:10', end: '09:40' },
    ]);
  });

  it('a keynote in the joined room blocks every breakout room it covers', () => {
    const d = venue();
    const ctx: ScheduleContext = { keynotes: keynoteBlocks([ks({ spaceId: d.combinations[1].id })], people) };
    const [d2, id] = withSession(d, { title: 'Breakout', durationMinutes: 30 });
    for (const r of d.rooms) expect(err(placeSession(d2, ctx, id, { spaceId: r.id, date: DAY, startTime: '09:30' }))).toMatch(/for "Opening Keynote"/);
    expect(placeSession(d2, ctx, id, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:00' }).ok).toBe(true);
    expect(findRoomClash(d2, ctx, { spaceId: d.rooms[2].id, date: DAY, start: toMinutes('09:00'), end: toMinutes('09:15') })?.title).toBe('Opening Keynote');
  });

  it('warns when a keynote speaker is also in a breakout during their segment', () => {
    const d = venue();
    const ctx: ScheduleContext = { keynotes: keynoteBlocks([ks({ spaceId: d.combinations[0].id })], people) };
    const [d2, id] = withSession(d, { title: 'Breakout', durationMinutes: 30, speakers: [{ id: 'stk_sarah', name: 'Sarah Chen' }] });
    const r = must(placeSession(d2, ctx, id, { spaceId: d.rooms[2].id, date: DAY, startTime: '09:30' }));
    expect(r.warnings[0].message).toBe('Sarah Chen is also in "Opening Keynote", 09:10 to 09:40.');
    expect(must(placeSession(d2, ctx, id, { spaceId: d.rooms[2].id, date: DAY, startTime: '09:40' })).warnings).toEqual([]);
  });
});

describe('moving and reassigning', () => {
  it('nudges a placed session by a slot, and refuses to run into another', () => {
    let d = venue();
    const a = d.rooms[0].id;
    let x: string, y: string;
    [d, x] = withSession(d, { title: 'X', durationMinutes: 30 });
    [d, y] = withSession(d, { title: 'Y', durationMinutes: 30 });
    d = must(placeSession(d, NO_CTX, x, { spaceId: a, date: DAY, startTime: '10:00' })).data;
    d = must(placeSession(d, NO_CTX, y, { spaceId: a, date: DAY, startTime: '10:30' })).data;
    expect(err(nudgeSession(d, NO_CTX, x, 15))).toMatch(/already booked/);
    expect(must(nudgeSession(d, NO_CTX, x, -15)).data.sessions[0].startTime).toBe('09:45');
    expect(err(nudgeSession(venue(), NO_CTX, 'none', 15))).toMatch(/Place the session/);
  });

  it('moving a placed session to another room keeps its time if that room is free', () => {
    let d = venue();
    let x: string;
    [d, x] = withSession(d, { title: 'X', durationMinutes: 30, spaceId: d.rooms[0].id });
    d = must(placeSession(d, NO_CTX, x, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:00' })).data;
    const moved = must(assignSpace(d, NO_CTX, x, d.rooms[1].id));
    expect(moved.data.sessions[0]).toMatchObject({ spaceId: d.rooms[1].id, startTime: '10:00', date: DAY });
  });

  it('assigning an unplaced session just picks its tray, and unassigning clears everything', () => {
    let d = venue();
    let x: string;
    [d, x] = withSession(d, { title: 'X', layoutId: 'layout_classroom', spaceId: d.rooms[0].id });
    const tray = must(assignSpace(d, NO_CTX, x, d.rooms[2].id));
    expect(tray.data.sessions[0].spaceId).toBe(d.rooms[2].id);
    expect(tray.data.sessions[0].startTime).toBeUndefined();
    expect(tray.data.sessions[0].layoutId).toBeUndefined(); // 3204 has no classroom layout
    const placed = must(placeSession(d, NO_CTX, x, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:00' })).data;
    const cleared = must(assignSpace(placed, NO_CTX, x, undefined)).data.sessions[0];
    expect(cleared).toMatchObject({ spaceId: undefined, layoutId: undefined, date: undefined, startTime: undefined });
  });

  it('unplacing returns a session to its room tray', () => {
    let d = venue();
    let x: string;
    [d, x] = withSession(d, { title: 'X', spaceId: d.rooms[0].id });
    d = must(placeSession(d, NO_CTX, x, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:00' })).data;
    expect(unplaceSession(d, x).sessions[0]).toMatchObject({ spaceId: d.rooms[0].id, date: undefined, startTime: undefined });
  });
});

describe('analysis and summary', () => {
  const sam = { id: 'stk_sam', name: 'Sam' };

  it('is not started when empty', () => {
    expect(scheduleSummary(createEmptySchedule(), NO_CTX)).toMatchObject({ state: 'not_started' });
  });

  it('counts unscheduled sessions as needing attention, and no rooms as a problem', () => {
    let [d] = withSession(createEmptySchedule(), { title: 'X' });
    const s = scheduleSummary(d, NO_CTX);
    expect(s.state).toBe('needs_attention');
    expect(s.attention.map((a) => a.label)).toEqual(['1 session is not on the agenda yet', '1 session has no stakeholder', 'No rooms have been added']);
    d = venue();
    expect(scheduleSummary(d, NO_CTX)).toMatchObject({ state: 'in_progress', headline: '0 sessions, 0 on the agenda \u00b7 3 rooms' });
  });

  it('is complete when everything is placed with nothing to flag', () => {
    let d = venue();
    let x: string;
    [d, x] = withSession(d, { title: 'X', speakers: [sam] });
    d = must(placeSession(d, NO_CTX, x, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:00' })).data;
    expect(scheduleSummary(d, NO_CTX)).toMatchObject({ state: 'complete', headline: '1 session, 1 on the agenda \u00b7 3 rooms' });
  });

  it('flags speaker clashes and capacity as warnings, and a removed room as critical', () => {
    let d = venue();
    let x: string, y: string;
    [d, x] = withSession(d, { title: 'X', durationMinutes: 60, speakers: [sam], expectedAttendance: 99 });
    [d, y] = withSession(d, { title: 'Y', durationMinutes: 60, speakers: [sam] });
    d = must(placeSession(d, NO_CTX, x, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:00', layoutId: 'layout_theatre' })).data;
    d = must(placeSession(d, NO_CTX, y, { spaceId: d.rooms[1].id, date: DAY, startTime: '10:30' })).data;
    const a = analyseSchedule(d, NO_CTX);
    expect(a.speakerClashes).toEqual([{ speaker: 'Sam', a: 'X', b: 'Y' }]);
    expect(a.overCapacity).toHaveLength(1);
    const s = scheduleSummary(d, NO_CTX);
    expect(s.attention.map((i) => i.severity)).toEqual(['warning', 'warning']);

    const orphan = { ...d, rooms: d.rooms.slice(1), combinations: [] };
    expect(scheduleSummary(orphan, NO_CTX).attention[0]).toMatchObject({ severity: 'critical' });
  });

  it('reports each speaker clash once, not twice', () => {
    let d = venue();
    let x: string, y: string;
    [d, x] = withSession(d, { title: 'X', durationMinutes: 60, speakers: [sam] });
    [d, y] = withSession(d, { title: 'Y', durationMinutes: 60, speakers: [sam] });
    d = must(placeSession(d, NO_CTX, x, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:00' })).data;
    d = must(placeSession(d, NO_CTX, y, { spaceId: d.rooms[1].id, date: DAY, startTime: '10:15' })).data;
    expect(analyseSchedule(d, NO_CTX).speakerClashes).toHaveLength(1);
  });
});

describe('housekeeping', () => {
  it('fills gaps in stored data and keeps time helpers honest', () => {
    expect(normaliseSchedule(null).layouts.length).toBeGreaterThan(0);
    expect(normaliseSchedule({ rooms: [{ id: 'r', name: 'R' } as never] }).rooms[0].capacities).toEqual({});
    expect(toMinutes('09:30')).toBe(570);
    expect(Number.isNaN(toMinutes('9'))).toBe(true);
    expect(fromMinutes(570)).toBe('09:30');
    expect(fromMinutes(5)).toBe('00:05');
  });
});

describe('resizing and per-session warnings', () => {
  it('lets an unplaced session change length freely, within limits', () => {
    const [d, id] = withSession(venue(), { title: 'X', durationMinutes: 30 });
    expect(must(resizeSession(d, NO_CTX, id, 90)).data.sessions[0].durationMinutes).toBe(90);
    expect(must(resizeSession(d, NO_CTX, id, 2)).data.sessions[0].durationMinutes).toBe(5);
  });

  it('will not let a placed session grow into the next booking, or out of the day', () => {
    let d = venue();
    const a = d.rooms[0].id;
    let x: string, y: string;
    [d, x] = withSession(d, { title: 'X', durationMinutes: 30 });
    [d, y] = withSession(d, { title: 'Y', durationMinutes: 30 });
    d = must(placeSession(d, NO_CTX, x, { spaceId: a, date: DAY, startTime: '10:00' })).data;
    d = must(placeSession(d, NO_CTX, y, { spaceId: a, date: DAY, startTime: '11:00' })).data;
    expect(err(resizeSession(d, NO_CTX, x, 75))).toMatch(/already booked 11:00 to 11:30 for "Y"/);
    expect(must(resizeSession(d, NO_CTX, x, 60)).data.sessions[0].durationMinutes).toBe(60);
    d = must(placeSession(d, NO_CTX, y, { spaceId: a, date: DAY, startTime: '17:30' })).data;
    expect(err(resizeSession(d, NO_CTX, y, 60))).toMatch(/outside the day's hours/);
  });

  it('reports the warnings for one placed session, and none for an unplaced one', () => {
    let d = venue();
    let x: string, y: string;
    const sam = { id: 'stk_sam', name: 'Sam' };
    [d, x] = withSession(d, { title: 'X', durationMinutes: 60, speakers: [sam], expectedAttendance: 99, layoutId: 'layout_theatre' });
    [d, y] = withSession(d, { title: 'Y', durationMinutes: 60, speakers: [sam] });
    d = must(placeSession(d, NO_CTX, x, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:00', layoutId: 'layout_theatre' })).data;
    d = must(placeSession(d, NO_CTX, y, { spaceId: d.rooms[1].id, date: DAY, startTime: '10:30' })).data;
    expect(sessionWarnings(d, NO_CTX, x).map((w) => w.kind).sort()).toEqual(['capacity', 'speaker']);
    expect(sessionWarnings(d, NO_CTX, y).map((w) => w.kind)).toEqual(['speaker']);
    const [d2, z] = withSession(venue(), { title: 'Z' });
    expect(sessionWarnings(d2, NO_CTX, z)).toEqual([]);
  });
});


/* ------------------------------------------------------------------ */
/* The Miro-inspired rules                                             */
/* ------------------------------------------------------------------ */

describe('the day\'s hours come from the event', () => {
  it('uses the event hours, unless the schedule sets its own, then 08:00 to 18:00', () => {
    const d = createEmptySchedule();
    expect(dayWindow(d, { eventHours: { start: '09:00', end: '19:30' } })).toMatchObject({ startText: '09:00', endText: '19:30', fromEvent: true });
    expect(dayWindow(d, {})).toMatchObject({ startText: '08:00', endText: '18:00', fromEvent: false });
    const own = { ...d, settings: { ...d.settings, dayStart: '07:30', dayEnd: '20:00' } };
    expect(dayWindow(own, { eventHours: { start: '09:00', end: '19:30' } })).toMatchObject({ startText: '07:30', endText: '20:00', fromEvent: false });
  });
  it('ignores hours that make no sense', () => {
    expect(dayWindow(createEmptySchedule(), { eventHours: { start: '18:00', end: '09:00' } })).toMatchObject({ startText: '08:00', endText: '18:00' });
    expect(dayWindow(createEmptySchedule(), { eventHours: { start: 'x', end: 'y' } })).toMatchObject({ startText: '08:00' });
  });
  it('placement follows the event hours', () => {
    const d = venue();
    const [d2, id] = withSession(d, { title: 'Early', durationMinutes: 30 });
    const ctx = { keynotes: [], eventHours: { start: '09:00', end: '17:00' } };
    expect(err(placeSession(d2, ctx, id, { spaceId: d.rooms[0].id, date: DAY, startTime: '08:30' }))).toMatch(/\(09:00 to 17:00\)/);
    expect(placeSession(d2, ctx, id, { spaceId: d.rooms[0].id, date: DAY, startTime: '09:00' }).ok).toBe(true);
  });
  it('an old stored 08:00 to 18:00 was only a default, so the event\'s hours take over', () => {
    const migrated = normaliseSchedule({ settings: { dayStart: '08:00', dayEnd: '18:00', slotMinutes: 15 } } as never);
    expect(migrated.settings.dayStart).toBeUndefined();
    const kept = normaliseSchedule({ settings: { dayStart: '07:00', dayEnd: '20:00', slotMinutes: 15 } } as never);
    expect(kept.settings.dayStart).toBe('07:00');
  });
});

/** A day like Day 1 of the board: keynote 9:00-10:30, break, 11:00-12:00 slot, lunch, slots after. */
function structured() {
  let d = venue();
  const ctx = { keynotes: [], eventHours: { start: '09:00', end: '18:00' } };
  const add = (kind: 'slot' | 'break' | 'event', label: string, start: string, end: string) => {
    d = must(addBlock(d, ctx, DAY, { kind, label, start, end }));
  };
  add('event', 'Opening Keynote (all attendees)', '09:00', '10:30');
  add('break', 'BREAK', '10:30', '11:00');
  add('slot', 'Session slot', '11:00', '12:00');
  add('break', 'LUNCH', '12:00', '13:30');
  add('slot', 'Session slot', '13:30', '14:30');
  add('slot', 'Session slot', '14:30', '15:30');
  return { d, ctx };
}

describe('day blocks: breaks, lunch, events and slots', () => {
  it('keeps blocks in time order and gives each kind a default label', () => {
    const { d, ctx } = structured();
    expect(blocksFor(d, DAY).map((b) => `${b.start}-${b.end} ${b.label}`)).toEqual([
      '09:00-10:30 Opening Keynote (all attendees)', '10:30-11:00 BREAK', '11:00-12:00 Session slot', '12:00-13:30 LUNCH', '13:30-14:30 Session slot', '14:30-15:30 Session slot',
    ]);
    expect(blocksFor(must(addBlock(d, ctx, DAY, { kind: 'break', start: '15:30', end: '15:45' })), DAY).at(-1)?.label).toBe('Break');
  });

  it('refuses blocks that overlap, run backwards, or fall outside the day', () => {
    const { d, ctx } = structured();
    expect(err(addBlock(d, ctx, DAY, { kind: 'break', start: '10:45', end: '11:15' }))).toMatch(/overlaps BREAK \(10:30 to 11:00\)/);
    expect(err(addBlock(d, ctx, DAY, { kind: 'break', start: '16:00', end: '15:00' }))).toMatch(/end after it starts/);
    expect(err(addBlock(d, ctx, DAY, { kind: 'event', start: '17:00', end: '19:00' }))).toMatch(/outside the day's hours \(09:00 to 18:00\)/);
    expect(err(addBlock(d, ctx, DAY, { kind: 'break', start: 'soon', end: '16:00' }))).toMatch(/09:30/);
  });

  it('will not put a break or event over a session already scheduled, but a fixed one may be run through', () => {
    const ctx = { keynotes: [], eventHours: { start: '09:00', end: '18:00' } };
    const d = venue();
    let x: string;
    let d2: ScheduleData;
    [d2, x] = withSession(d, { title: 'Talk', durationMinutes: 60 });
    d2 = must(placeSession(d2, ctx, x, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:00' })).data;
    expect(err(addBlock(d2, ctx, DAY, { kind: 'break', start: '10:30', end: '11:30' }))).toMatch(/1 session is already in that time, starting with "Talk"/);
    expect(addBlock(d2, ctx, DAY, { kind: 'break', start: '11:00', end: '11:30' }).ok).toBe(true); // after it ends
    const fixed = updateSession(d2, x, { fixed: true });
    expect(addBlock(fixed, ctx, DAY, { kind: 'break', start: '10:30', end: '11:30' }).ok).toBe(true);
  });

  it('will not remove or shrink a slot that has a session in it', () => {
    const { d, ctx } = structured();
    const slot = blocksFor(d, DAY).find((b) => b.start === '11:00')!;
    let x: string;
    let d2: ScheduleData;
    [d2, x] = withSession(d, { title: 'Talk', durationMinutes: 60 });
    d2 = must(placeSession(d2, ctx, x, { spaceId: d.rooms[0].id, date: DAY, startTime: '11:00' })).data;
    expect(err(removeBlock(d2, DAY, slot.id))).toMatch(/"Talk" is in that slot/);
    expect(err(updateBlock(d2, ctx, DAY, slot.id, { end: '11:30' }))).toMatch(/"Talk" is in that slot/);
    expect(err(updateBlock(d2, ctx, DAY, slot.id, { kind: 'break' }))).toMatch(/"Talk"/);
    expect(must(updateBlock(d, ctx, DAY, slot.id, { end: '11:30' })).dayBlocks[DAY].find((b) => b.id === slot.id)?.end).toBe('11:30');
    expect(must(removeBlock(d, DAY, slot.id)).dayBlocks[DAY]).toHaveLength(5);
  });

  it('fills the gaps between blocks with slots of a set length', () => {
    let d = venue();
    const ctx = { keynotes: [], eventHours: { start: '09:00', end: '14:00' } };
    d = must(addBlock(d, ctx, DAY, { kind: 'break', label: 'LUNCH', start: '12:00', end: '13:00' }));
    d = must(fillSlots(d, ctx, DAY, 60));
    expect(blocksFor(d, DAY).filter((b) => b.kind === 'slot').map((b) => `${b.start}-${b.end}`)).toEqual(['09:00-10:00', '10:00-11:00', '11:00-12:00', '13:00-14:00']);
    expect(err(fillSlots(d, ctx, DAY, 60))).toMatch(/no gaps/);
  });

  it('keeps a short leftover as a slot only if it is worth having', () => {
    const ctx = { keynotes: [], eventHours: { start: '09:00', end: '10:30' } };
    const d = must(fillSlots(venue(), ctx, DAY, 60));
    expect(blocksFor(d, DAY).map((b) => `${b.start}-${b.end}`)).toEqual(['09:00-10:00', '10:00-10:30']);
    const tiny = must(fillSlots(venue(), { keynotes: [], eventHours: { start: '09:00', end: '10:10' } }, DAY, 60));
    expect(blocksFor(tiny, DAY)).toHaveLength(1);
  });

  it('copies one day\'s structure to others without touching the original', () => {
    const { d } = structured();
    const copied = must(copyBlocks(d, DAY, ['2026-11-10', '2026-11-11']));
    expect(blocksFor(copied, '2026-11-10').map((b) => b.label)).toEqual(blocksFor(d, DAY).map((b) => b.label));
    expect(blocksFor(copied, '2026-11-10')[0].id).not.toBe(blocksFor(d, DAY)[0].id);
    expect(blocksFor(copied, DAY)).toEqual(blocksFor(d, DAY));
  });
});

describe('where a session may go', () => {
  it('refuses a break or an all-attendee event, naming it', () => {
    const { d, ctx } = structured();
    expect(timeProblem(d, ctx, DAY, toMinutes('10:30'), toMinutes('11:00'), false)).toBe('That is during BREAK (10:30 to 11:00).');
    expect(timeProblem(d, ctx, DAY, toMinutes('09:30'), toMinutes('10:15'), false)).toMatch(/Opening Keynote/);
    expect(timeProblem(d, ctx, DAY, toMinutes('11:30'), toMinutes('12:30'), false)).toMatch(/LUNCH/);
  });

  it('keeps sessions in the slots, and says when one does not fit', () => {
    const { d, ctx } = structured();
    expect(timeProblem(d, ctx, DAY, toMinutes('11:00'), toMinutes('12:00'), false)).toBeNull();
    expect(timeProblem(d, ctx, DAY, toMinutes('11:00'), toMinutes('12:15'), false)).toMatch(/LUNCH/); // runs into lunch
    expect(timeProblem(d, ctx, DAY, toMinutes('14:00'), toMinutes('15:30'), false)).toBeNull(); // across the join of two adjacent slots
    expect(timeProblem(d, ctx, DAY, toMinutes('14:30'), toMinutes('16:00'), false)).toMatch(/does not fit there: the open time runs 13:30 to 15:30/);
    expect(timeProblem(d, ctx, DAY, toMinutes('16:00'), toMinutes('16:30'), false)).toMatch(/go in the session slots/);
  });

  it('adjacent slots are one open stretch', () => {
    const { d } = structured();
    expect(openStretches(d, DAY)).toEqual([{ start: 660, end: 720 }, { start: 810, end: 930 }]);
  });

  it('a day with no slots is free, except for breaks and events', () => {
    const ctx = { keynotes: [], eventHours: { start: '09:00', end: '17:00' } };
    const d = must(addBlock(venue(), ctx, DAY, { kind: 'break', label: 'LUNCH', start: '12:00', end: '13:00' }));
    expect(timeProblem(d, ctx, DAY, toMinutes('10:07'), toMinutes('10:52'), false)).toBeNull();
    expect(timeProblem(d, ctx, DAY, toMinutes('11:30'), toMinutes('12:30'), false)).toMatch(/LUNCH/);
    expect(timeProblem(d, ctx, '2026-11-12', toMinutes('12:00'), toMinutes('13:00'), false)).toBeNull(); // another day
  });

  it('a fixed session may run through a break or outside the slots, but not outside the day', () => {
    const { d, ctx } = structured();
    expect(timeProblem(d, ctx, DAY, toMinutes('15:00'), toMinutes('17:30'), true)).toBeNull();
    expect(timeProblem(d, ctx, DAY, toMinutes('11:30'), toMinutes('13:00'), true)).toBeNull();
    expect(timeProblem(d, ctx, DAY, toMinutes('17:00'), toMinutes('18:30'), true)).toMatch(/outside the day's hours/);
  });

  it('placeSession uses all of it, including for a fixed session', () => {
    const { d, ctx } = structured();
    let a: string, f: string;
    let d2: ScheduleData;
    [d2, a] = withSession(d, { title: 'Normal', durationMinutes: 60 });
    [d2, f] = withSession(d2, { title: 'Hackathon', durationMinutes: 150, fixed: true });
    expect(err(placeSession(d2, ctx, a, { spaceId: d.rooms[0].id, date: DAY, startTime: '10:30' }))).toMatch(/during BREAK/);
    expect(placeSession(d2, ctx, a, { spaceId: d.rooms[0].id, date: DAY, startTime: '11:00' }).ok).toBe(true);
    expect(placeSession(d2, ctx, f, { spaceId: d.rooms[1].id, date: DAY, startTime: '15:00' }).ok).toBe(true);
  });

  it('snaps a drop to the slot it is in, else to the grid', () => {
    const { d } = structured();
    expect(snapStart(d, DAY, toMinutes('11:40'), 15, 540)).toBe(toMinutes('11:00'));
    expect(snapStart(d, DAY, toMinutes('14:45'), 15, 540)).toBe(toMinutes('14:30')); // in the second adjacent slot
    expect(snapStart(d, DAY, toMinutes('16:07'), 15, 540)).toBe(toMinutes('16:00')); // outside any slot: grid
    expect(snapStart(d, DAY, toMinutes('16:08'), 15, 540)).toBe(toMinutes('16:15'));
  });

  it('a fixed session cannot be nudged', () => {
    const { d, ctx } = structured();
    let f: string;
    let d2: ScheduleData;
    [d2, f] = withSession(d, { title: 'Hackathon', durationMinutes: 60, fixed: true });
    d2 = must(placeSession(d2, ctx, f, { spaceId: d.rooms[0].id, date: DAY, startTime: '11:00' })).data;
    expect(err(nudgeSession(d2, ctx, f, 15))).toMatch(/fixed in place/);
  });
});

describe('room setup by day', () => {
  it('a room is in one layout for the day, defaulting to the first layout it offers', () => {
    const d = venue();
    const a = d.rooms[0].id; // offers Theatre and Classroom
    expect(dayLayoutId(d, DAY, a)).toBe('layout_theatre');
    const set = must(setDayLayout(d, DAY, a, 'layout_classroom'));
    expect(dayLayoutId(set, DAY, a)).toBe('layout_classroom');
    expect(dayLayoutId(set, '2026-11-10', a)).toBe('layout_theatre'); // another day is unaffected
    expect(dayLayoutId(must(setDayLayout(set, DAY, a, null)), DAY, a)).toBe('layout_theatre');
  });

  it('only accepts a layout the room offers', () => {
    const d = venue();
    expect(err(setDayLayout(d, DAY, d.rooms[2].id, 'layout_classroom'))).toMatch(/does not offer/);
    expect(err(setDayLayout(d, DAY, 'nope', 'layout_theatre'))).toMatch(/no longer exists/);
  });

  it('can set the same layout on every day', () => {
    const d = venue();
    const all = must(setLayoutForAllDays(d, [DAY, '2026-11-10'], d.rooms[0].id, 'layout_classroom'));
    expect([DAY, '2026-11-10'].map((x) => dayLayoutId(all, x, d.rooms[0].id))).toEqual(['layout_classroom', 'layout_classroom']);
  });

  it('a session takes its layout from the day, unless it chooses its own', () => {
    let d = venue();
    const a = d.rooms[0].id;
    d = must(setDayLayout(d, DAY, a, 'layout_classroom'));
    let id: string;
    [d, id] = withSession(d, { title: 'Talk', spaceId: a });
    d = must(placeSession(d, NO_CTX, id, { spaceId: a, date: DAY, startTime: '10:00' })).data;
    expect(effectiveLayoutId(d, d.sessions[0])).toBe('layout_classroom');
    expect(effectiveLayoutId(updateSession(d, id, { layoutId: 'layout_theatre' }), d.sessions[0] && { ...d.sessions[0], layoutId: 'layout_theatre' })).toBe('layout_theatre');
  });

  it('capacity warnings use the day\'s layout: a Classroom day seats fewer', () => {
    let d = venue();
    const a = d.rooms[0].id; // theatre 60, classroom 30
    let id: string;
    [d, id] = withSession(d, { title: 'Talk', spaceId: a, expectedAttendance: 45 });
    expect(must(placeSession(d, NO_CTX, id, { spaceId: a, date: DAY, startTime: '10:00' })).warnings).toEqual([]);
    d = must(setDayLayout(d, DAY, a, 'layout_classroom'));
    const r = must(placeSession(d, NO_CTX, id, { spaceId: a, date: DAY, startTime: '10:00' }));
    expect(r.warnings).toEqual([{ kind: 'capacity', message: 'Expects 45 people but the room seats 30 in Classroom.' }]);
  });
});

describe('session labels, origin, tags and fixing', () => {
  it('creates a session as internal by default, and keeps code, guests, tags and fixed', () => {
    const s = must(createSession({ code: ' D-1805 ', title: 'Above and Below', origin: 'external', guests: ' Marcello Sgambelluri (AG&E) ', tags: ['Field Systems', 'field systems', ' SketchUp ', ''], fixed: true }));
    expect(s).toMatchObject({ code: 'D-1805', origin: 'external', guests: 'Marcello Sgambelluri (AG&E)', tags: ['Field Systems', 'SketchUp'], fixed: true });
    const plain = must(createSession({ title: 'x' }));
    expect(plain).toMatchObject({ origin: 'internal', tags: [] });
    expect(plain.fixed).toBeUndefined();
    expect(must(createSession({ title: 'x', origin: 'nonsense' as never })).origin).toBe('internal');
  });

  it('labels with the code when there is one', () => {
    expect(sessionLabel({ code: 'D-1805', title: 'Above and Below' })).toBe('D-1805: Above and Below');
    expect(sessionLabel({ title: 'Plain' })).toBe('Plain');
  });

  it('collects the tags in use, once each, in order', () => {
    let d = venue();
    [d] = withSession(d, { title: 'a', tags: ['Tekla', 'AI'] });
    [d] = withSession(d, { title: 'b', tags: ['ai', 'Connect'] });
    expect(allTags(d)).toEqual(['AI', 'Connect', 'Tekla']);
    expect(cleanTags([' a ', 'A', 'b'])).toEqual(['a', 'b']);
  });

  it('old stored sessions without an origin or tags load as internal with no tags', () => {
    const n = normaliseSchedule({ sessions: [{ id: 's', title: 'Old', speakers: [], durationMinutes: 30 } as never] });
    expect(n.sessions[0]).toMatchObject({ origin: 'internal', tags: [] });
  });

  it('the summary counts internal and external, and flags sessions with no stakeholder', () => {
    let d = venue();
    const sam = { id: 'stk_sam', name: 'Sam' };
    [d] = withSession(d, { title: 'In', speakers: [sam] });
    [d] = withSession(d, { title: 'Ext', origin: 'external', speakers: [sam] });
    [d] = withSession(d, { title: 'Orphan' });
    const s = scheduleSummary(d, NO_CTX);
    expect(s.headline).toBe('3 sessions (2 internal, 1 external), 0 on the agenda \u00b7 3 rooms');
    expect(s.attention.map((a) => a.label)).toContain('1 session has no stakeholder');
  });
});


describe('times and the hours of a day', () => {
  it('toMinutes accepts real times, and 24:00 as the end of a day, and refuses the rest', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('9:05')).toBe(545);
    expect(toMinutes('23:59')).toBe(1439);
    expect(toMinutes('24:00')).toBe(1440);
    for (const bad of ['25:00', '24:01', '09:60', '9:5', '-1:00', ' 09:00', '09:00:30', '', 'ab:cd']) expect(toMinutes(bad), bad).toBeNaN();
  });

  it('shows hours padded, whatever way they were stored', () => {
    const w = dayWindow(createEmptySchedule(), { eventHours: { start: '9:00', end: '17:30' } });
    expect([w.startText, w.endText]).toEqual(['09:00', '17:30']);
  });

  it('says the hours are the event\'s only when they are', () => {
    const d = createEmptySchedule();
    expect(dayWindow(d, { eventHours: { start: '09:00', end: '17:00' } })).toMatchObject({ fromEvent: true, eventHoursUnusable: false });
    expect(dayWindow(d, {})).toMatchObject({ fromEvent: false, eventHoursUnusable: false });
    expect(dayWindow({ ...d, settings: { ...d.settings, dayStart: '07:00', dayEnd: '20:00' } }, { eventHours: { start: '09:00', end: '17:00' } })).toMatchObject({
      fromEvent: false, eventHoursUnusable: false, startText: '07:00',
    });
  });

  it('is honest when the event hours cannot be used: overnight, no length, or not times at all', () => {
    const d = createEmptySchedule();
    for (const hours of [{ start: '22:00', end: '02:00' }, { start: '00:00', end: '00:00' }, { start: '10:00', end: '10:00' }, { start: 'x', end: 'y' }]) {
      const w = dayWindow(d, { eventHours: hours });
      expect(w, JSON.stringify(hours)).toMatchObject({ fromEvent: false, eventHoursUnusable: true, startText: '08:00', endText: '18:00' });
    }
  });
});
