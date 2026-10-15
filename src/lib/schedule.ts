import type {
  BlockKind,
  KeynoteBlock,
  ScheduleCombination,
  ScheduleData,
  ScheduleLayout,
  ScheduleRoom,
  ScheduleSession,
  ScheduleSettings,
  SessionOrigin,
  Space,
  TimeBlock,
} from '@/types/schedule';
import type { KeynoteSession, KeyStakeholder } from '@/types';
import type { ModuleAttentionItem, ModuleSummary } from '@/types/moduleSummary';
import { parseLink } from './links';

export const SCHEDULE_MODULE_ID = 'schedule';

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const ok = <T>(data: T): { ok: true; data: T } => ({ ok: true, data });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ */
/* Defaults and loading                                                */
/* ------------------------------------------------------------------ */

export const DEFAULT_LAYOUT_NAMES = ['Theatre', 'Classroom', 'Boardroom', 'Cabaret', 'U-Shape', 'Reception'];
export const DEFAULT_SETTINGS: ScheduleSettings = { slotMinutes: 15 };
/** Used only when neither the schedule nor the event says what the day's hours are. */
export const FALLBACK_DAY = { start: '08:00', end: '18:00' };

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function createEmptySchedule(): ScheduleData {
  return {
    layouts: DEFAULT_LAYOUT_NAMES.map((name) => ({ id: `layout_${slug(name)}`, name })),
    rooms: [],
    combinations: [],
    sessions: [],
    settings: { ...DEFAULT_SETTINGS },
    dayBlocks: {},
    daySetups: {},
  };
}

export function normaliseSchedule(raw: Partial<ScheduleData> | null | undefined): ScheduleData {
  const empty = createEmptySchedule();
  if (!raw) return empty;
  const settings: ScheduleSettings = { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) };
  // Earlier versions always stored 08:00 to 18:00. That was a default, not a choice, so let the event's hours take over.
  if (settings.dayStart === '08:00' && settings.dayEnd === '18:00') {
    delete settings.dayStart;
    delete settings.dayEnd;
  }
  return {
    layouts: Array.isArray(raw.layouts) && raw.layouts.length > 0 ? raw.layouts : empty.layouts,
    rooms: (Array.isArray(raw.rooms) ? raw.rooms : []).map((r) => ({ ...r, capacities: r.capacities ?? {} })),
    combinations: (Array.isArray(raw.combinations) ? raw.combinations : []).map((c) => ({ ...c, capacities: c.capacities ?? {} })),
    sessions: (Array.isArray(raw.sessions) ? raw.sessions : []).map((s) => ({
      ...s,
      origin: s.origin === 'external' ? 'external' : 'internal',
      speakers: s.speakers ?? [],
      tags: Array.isArray(s.tags) ? s.tags : [],
    })),
    settings,
    dayBlocks: raw.dayBlocks && typeof raw.dayBlocks === 'object' ? raw.dayBlocks : {},
    daySetups: raw.daySetups && typeof raw.daySetups === 'object' ? raw.daySetups : {},
  };
}

/* ------------------------------------------------------------------ */
/* Time                                                                */
/* ------------------------------------------------------------------ */

/** Minutes since midnight for "HH:MM", or NaN if it is not a real time. 24:00 is allowed, as the end of a day. */
export function toMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time || '');
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) return NaN;
  return h * 60 + min;
}

export function fromMinutes(total: number): string {
  const t = Math.max(0, Math.round(total));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/* ------------------------------------------------------------------ */
/* Spaces                                                              */
/* ------------------------------------------------------------------ */

/**
 * "Murano 3202", "Murano 3203", "Murano 3204" becomes "Murano 3202, 3203, 3204". Names with
 * nothing in common are simply joined with commas.
 */
export function defaultSpaceName(names: string[]): string {
  if (names.length < 2) return names[0] ?? '';
  const words = names.map((n) => n.trim().split(/\s+/));
  let prefix = 0;
  while (words.every((w) => w.length > prefix && w[prefix] === words[0][prefix])) prefix++;
  const rest = words.map((w) => w.slice(prefix).join(' '));
  if (prefix > 0 && rest.every(Boolean)) return `${words[0].slice(0, prefix).join(' ')} ${rest.join(', ')}`;
  return names.join(', ');
}

export function listSpaces(data: ScheduleData): Space[] {
  const roomName = (id: string) => data.rooms.find((r) => r.id === id)?.name ?? '';
  return [
    ...data.rooms.map((r): Space => ({ id: r.id, name: r.name, roomIds: [r.id], kind: 'room', capacities: r.capacities })),
    ...data.combinations.map(
      (c): Space => ({
        id: c.id,
        name: c.name?.trim() || defaultSpaceName(c.roomIds.map(roomName)),
        roomIds: c.roomIds,
        kind: 'combination',
        capacities: c.capacities,
      })
    ),
  ];
}

export const getSpace = (data: ScheduleData, id?: string): Space | undefined =>
  id ? listSpaces(data).find((s) => s.id === id) : undefined;

/** The layouts a space offers, in the event's layout order, with their capacities. */
export function layoutsFor(data: ScheduleData, spaceId?: string): { layout: ScheduleLayout; capacity: number }[] {
  const space = getSpace(data, spaceId);
  if (!space) return [];
  return data.layouts
    .filter((l) => (space.capacities[l.id] ?? 0) > 0)
    .map((layout) => ({ layout, capacity: space.capacities[layout.id] }));
}

export const capacityFor = (data: ScheduleData, spaceId?: string, layoutId?: string): number | undefined =>
  layoutId ? getSpace(data, spaceId)?.capacities[layoutId] : undefined;

/* ------------------------------------------------------------------ */
/* Layouts                                                             */
/* ------------------------------------------------------------------ */

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function addLayout(data: ScheduleData, name: string): Result<ScheduleData> {
  const n = name.trim();
  if (!n) return fail('Give the layout a name.');
  if (data.layouts.some((l) => sameName(l.name, n))) return fail(`There is already a layout called ${n}.`);
  let id = `layout_${slug(n)}`;
  while (data.layouts.some((l) => l.id === id)) id += '_2';
  return ok({ ...data, layouts: [...data.layouts, { id, name: n }] });
}

export function renameLayout(data: ScheduleData, id: string, name: string): Result<ScheduleData> {
  const n = name.trim();
  if (!n) return fail('Give the layout a name.');
  if (data.layouts.some((l) => l.id !== id && sameName(l.name, n))) return fail(`There is already a layout called ${n}.`);
  return ok({ ...data, layouts: data.layouts.map((l) => (l.id === id ? { ...l, name: n } : l)) });
}

export function removeLayout(data: ScheduleData, id: string): Result<ScheduleData> {
  const name = data.layouts.find((l) => l.id === id)?.name ?? 'That layout';
  const used = [...data.rooms, ...data.combinations].some((s) => (s.capacities[id] ?? 0) > 0);
  if (used) return fail(`${name} is offered by a room. Remove its capacities first.`);
  if (data.sessions.some((s) => s.layoutId === id)) return fail(`${name} is chosen for a session.`);
  return ok({ ...data, layouts: data.layouts.filter((l) => l.id !== id) });
}

/* ------------------------------------------------------------------ */
/* Rooms and combinations                                              */
/* ------------------------------------------------------------------ */

export function addRoom(data: ScheduleData, name: string): Result<ScheduleData> {
  const n = name.trim();
  if (!n) return fail('Give the room a name.');
  if (data.rooms.some((r) => sameName(r.name, n))) return fail(`There is already a room called ${n}.`);
  const room: ScheduleRoom = { id: uid('room'), name: n, capacities: {} };
  return ok({ ...data, rooms: [...data.rooms, room] });
}

export function renameRoom(data: ScheduleData, id: string, name: string): Result<ScheduleData> {
  const n = name.trim();
  if (!n) return fail('Give the room a name.');
  if (data.rooms.some((r) => r.id !== id && sameName(r.name, n))) return fail(`There is already a room called ${n}.`);
  return ok({ ...data, rooms: data.rooms.map((r) => (r.id === id ? { ...r, name: n } : r)) });
}

/** Spaces that something depends on: scheduled sessions, sessions waiting in a tray, and keynotes. */
export function spaceUses(data: ScheduleData, spaceId: string, keynoteSpaceIds: string[] = []): string[] {
  const uses: string[] = [];
  const sessions = data.sessions.filter((s) => s.spaceId === spaceId).length;
  if (sessions > 0) uses.push(plural(sessions, 'session', 'sessions'));
  const keynotes = keynoteSpaceIds.filter((id) => id === spaceId).length;
  if (keynotes > 0) uses.push(plural(keynotes, 'keynote', 'keynotes'));
  return uses;
}

export function removeRoom(data: ScheduleData, id: string, keynoteSpaceIds: string[] = []): Result<ScheduleData> {
  const room = data.rooms.find((r) => r.id === id);
  if (!room) return fail('That room no longer exists.');
  const combo = data.combinations.find((c) => c.roomIds.includes(id));
  if (combo) return fail(`${room.name} is part of ${getSpace(data, combo.id)?.name}. Remove that combination first.`);
  const uses = spaceUses(data, id, keynoteSpaceIds);
  if (uses.length > 0) return fail(`${room.name} has ${uses.join(' and ')}. Move or remove them first.`);
  return ok({ ...data, rooms: data.rooms.filter((r) => r.id !== id) });
}

/** Whether these rooms sit next to each other in the room order: airwalls only join neighbours. */
export function isContiguous(data: ScheduleData, roomIds: string[]): boolean {
  const idx = roomIds.map((id) => data.rooms.findIndex((r) => r.id === id)).sort((a, b) => a - b);
  return idx.length > 0 && idx.every((i, k) => i >= 0 && (k === 0 || i === idx[k - 1] + 1));
}

export function moveRoom(data: ScheduleData, id: string, delta: -1 | 1): Result<ScheduleData> {
  const from = data.rooms.findIndex((r) => r.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= data.rooms.length) return ok(data);
  const rooms = [...data.rooms];
  const [moved] = rooms.splice(from, 1);
  rooms.splice(to, 0, moved);
  const next = { ...data, rooms };
  const broken = data.combinations.find((c) => !isContiguous(next, c.roomIds));
  if (broken) return fail(`That would split ${getSpace(data, broken.id)?.name}, which joins neighbouring rooms.`);
  return ok(next);
}

export function addCombination(data: ScheduleData, roomIds: string[], name?: string): Result<ScheduleData> {
  const unique = [...new Set(roomIds)];
  if (unique.length < 2) return fail('Choose at least two rooms to join.');
  if (unique.some((id) => !data.rooms.some((r) => r.id === id))) return fail('One of those rooms no longer exists.');
  if (!isContiguous(data, unique)) return fail('Only rooms that sit next to each other can be joined.');
  const key = [...unique].sort().join('|');
  if (data.combinations.some((c) => [...c.roomIds].sort().join('|') === key)) return fail('Those rooms are already joined as a combination.');
  const ordered = unique.sort((a, b) => data.rooms.findIndex((r) => r.id === a) - data.rooms.findIndex((r) => r.id === b));
  const combo: ScheduleCombination = { id: uid('combo'), roomIds: ordered, name: name?.trim() || undefined, capacities: {} };
  return ok({ ...data, combinations: [...data.combinations, combo] });
}

export function renameCombination(data: ScheduleData, id: string, name: string): ScheduleData {
  return { ...data, combinations: data.combinations.map((c) => (c.id === id ? { ...c, name: name.trim() || undefined } : c)) };
}

export function removeCombination(data: ScheduleData, id: string, keynoteSpaceIds: string[] = []): Result<ScheduleData> {
  const uses = spaceUses(data, id, keynoteSpaceIds);
  if (uses.length > 0) return fail(`${getSpace(data, id)?.name} has ${uses.join(' and ')}. Move or remove them first.`);
  return ok({ ...data, combinations: data.combinations.filter((c) => c.id !== id) });
}

/** Sets how many people a space seats in a layout, or removes the layout from the space with null. */
export function setCapacity(data: ScheduleData, spaceId: string, layoutId: string, capacity: number | null): Result<ScheduleData> {
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) return fail('Capacity must be a whole number of at least 1.');
  if (capacity === null && data.sessions.some((s) => s.spaceId === spaceId && s.layoutId === layoutId)) {
    return fail('A session in this space uses that layout.');
  }
  const apply = <T extends { id: string; capacities: Record<string, number> }>(item: T): T => {
    if (item.id !== spaceId) return item;
    const capacities = { ...item.capacities };
    if (capacity === null) delete capacities[layoutId];
    else capacities[layoutId] = capacity;
    return { ...item, capacities };
  };
  if (!getSpace(data, spaceId)) return fail('That room no longer exists.');
  return ok({ ...data, rooms: data.rooms.map(apply), combinations: data.combinations.map(apply) });
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export interface SessionInput {
  code?: string;
  title: string;
  abstract?: string;
  presentationUrl?: string;
  origin?: SessionOrigin;
  speakers?: ScheduleSession['speakers'];
  guests?: string;
  tags?: string[];
  fixed?: boolean;
  durationMinutes?: number;
  spaceId?: string;
  layoutId?: string;
  expectedAttendance?: number;
}

export const MIN_SESSION_MINUTES = 5;
export const MAX_SESSION_MINUTES = 480;
export const clampDuration = (n: number) => Math.min(MAX_SESSION_MINUTES, Math.max(MIN_SESSION_MINUTES, Math.round(n) || 45));

/** Trimmed, without blanks or repeats (ignoring case), keeping the first spelling. */
export function cleanTags(tags: string[] = []): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const t = raw.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

export const allTags = (data: ScheduleData): string[] =>
  cleanTags(data.sessions.flatMap((s) => s.tags)).sort((a, b) => a.localeCompare(b));

export function createSession(input: SessionInput, now: Date = new Date()): Result<ScheduleSession> {
  const title = input.title.trim();
  if (!title) return fail('Give the session a title.');
  let url: string | undefined;
  if (input.presentationUrl?.trim()) {
    const parsed = parseLink(input.presentationUrl);
    if (parsed.ok === false) return fail(parsed.error);
    url = parsed.url;
  }
  return ok({
    id: `sess_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    code: input.code?.trim() || undefined,
    title,
    abstract: input.abstract?.trim() || undefined,
    presentationUrl: url,
    origin: input.origin === 'external' ? 'external' : 'internal',
    speakers: input.speakers ?? [],
    guests: input.guests?.trim() || undefined,
    tags: cleanTags(input.tags),
    fixed: input.fixed || undefined,
    durationMinutes: clampDuration(input.durationMinutes ?? 45),
    spaceId: input.spaceId || undefined,
    layoutId: input.layoutId || undefined,
    expectedAttendance: input.expectedAttendance && input.expectedAttendance > 0 ? Math.round(input.expectedAttendance) : undefined,
  });
}

/** "D-1805: Above and Below the Surface", or just the title when there is no code. */
export const sessionLabel = (s: Pick<ScheduleSession, 'code' | 'title'>): string => (s.code ? `${s.code}: ${s.title}` : s.title);

export const isScheduled = (s: ScheduleSession): boolean => !!(s.spaceId && s.date && s.startTime);

export const sessionEnd = (s: ScheduleSession): string => fromMinutes(toMinutes(s.startTime ?? '') + s.durationMinutes);

export function removeSession(data: ScheduleData, id: string): ScheduleData {
  return { ...data, sessions: data.sessions.filter((s) => s.id !== id) };
}

export function updateSession(data: ScheduleData, id: string, patch: Partial<ScheduleSession>): ScheduleData {
  return { ...data, sessions: data.sessions.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function unplaceSession(data: ScheduleData, id: string): ScheduleData {
  return updateSession(data, id, { date: undefined, startTime: undefined });
}

/* ------------------------------------------------------------------ */
/* Keynotes                                                            */
/* ------------------------------------------------------------------ */

/** The Keynote module's sessions that have a room, as blocks the agenda can show and clash against. */
export function keynoteBlocks(sessions: KeynoteSession[], stakeholders: KeyStakeholder[]): KeynoteBlock[] {
  const nameOf = new Map(stakeholders.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));
  return sessions
    .filter((s) => s.spaceId && s.date && s.startTime && s.endTime)
    .map((s) => ({
      id: s.id,
      title: s.title,
      spaceId: s.spaceId as string,
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      speakerWindows: s.segments.flatMap((seg) => {
        const m = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(seg.time || '');
        if (!m) return [];
        return (seg.speakerIds ?? []).map((id) => ({ speakerId: id, speakerName: nameOf.get(id) ?? id, start: m[1], end: m[2] }));
      }),
    }));
}

/* ------------------------------------------------------------------ */
/* The day: hours, blocks and room setup                               */
/* ------------------------------------------------------------------ */

export interface DayWindow {
  start: number;
  end: number;
  startText: string;
  endText: string;
  /** True when these are the event's own hours. */
  fromEvent: boolean;
  /** True when the event has hours but they cannot be used (overnight, or no length), so the default is in force. */
  eventHoursUnusable: boolean;
}

/**
 * The hours the agenda covers: the schedule's own if set, else the event's, else 08:00 to 18:00. Hours
 * that make no sense (ending before they start) fall back to the default, and say so.
 */
export function dayWindow(data: ScheduleData, ctx: Pick<ScheduleContext, 'eventHours'>): DayWindow {
  const valid = (t?: string) => (t && !Number.isNaN(toMinutes(t)) ? t : undefined);
  const ownStart = valid(data.settings.dayStart);
  const ownEnd = valid(data.settings.dayEnd);
  const eventStart = valid(ctx.eventHours?.start);
  const eventEnd = valid(ctx.eventHours?.end);

  let startText = ownStart ?? eventStart ?? FALLBACK_DAY.start;
  let endText = ownEnd ?? eventEnd ?? FALLBACK_DAY.end;
  let defaulted = false;
  if (toMinutes(endText) <= toMinutes(startText)) {
    startText = FALLBACK_DAY.start;
    endText = FALLBACK_DAY.end;
    defaulted = true;
  }
  const ownHours = !!data.settings.dayStart || !!data.settings.dayEnd;
  const eventUsable = !!eventStart && !!eventEnd;
  const start = toMinutes(startText);
  const end = toMinutes(endText);
  return {
    start,
    end,
    startText: fromMinutes(start),
    endText: fromMinutes(end),
    fromEvent: !ownHours && eventUsable && !defaulted,
    eventHoursUnusable: !!ctx.eventHours && !ownHours && (!eventUsable || defaulted),
  };
}

export const blocksFor = (data: ScheduleData, date?: string): TimeBlock[] =>
  date ? [...(data.dayBlocks[date] ?? [])].sort((a, b) => toMinutes(a.start) - toMinutes(b.start)) : [];

const KIND_LABEL: Record<BlockKind, string> = { slot: 'Session slot', break: 'Break', event: 'Event' };
export const defaultBlockLabel = (kind: BlockKind) => KIND_LABEL[kind];

interface BlockInput {
  kind: BlockKind;
  label?: string;
  start: string;
  end: string;
}

/** Scheduled sessions that sit inside a stretch of a day. Fixed ones are left out: they may run through anything. */
function sessionsIn(data: ScheduleData, date: string, start: number, end: number, includeFixed = false): ScheduleSession[] {
  return data.sessions.filter((s) => {
    if (!isScheduled(s) || s.date !== date || (s.fixed && !includeFixed)) return false;
    const a = toMinutes(s.startTime as string);
    return overlaps(start, end, a, a + s.durationMinutes);
  });
}

function checkBlock(data: ScheduleData, ctx: ScheduleContext, date: string, input: BlockInput, ignoreId?: string): Result<TimeBlock> {
  const start = toMinutes(input.start);
  const end = toMinutes(input.end);
  if (Number.isNaN(start) || Number.isNaN(end)) return fail('Enter start and end times such as 09:30.');
  if (end <= start) return fail('A block has to end after it starts.');
  const w = dayWindow(data, ctx);
  if (start < w.start || end > w.end) return fail(`That is outside the day's hours (${w.startText} to ${w.endText}).`);
  const clash = blocksFor(data, date).find((b) => b.id !== ignoreId && overlaps(start, end, toMinutes(b.start), toMinutes(b.end)));
  if (clash) return fail(`That overlaps ${clash.label} (${clash.start} to ${clash.end}).`);
  if (input.kind !== 'slot') {
    const inTheWay = sessionsIn(data, date, start, end);
    if (inTheWay.length > 0) return fail(`${plural(inTheWay.length, 'session is', 'sessions are')} already in that time, starting with "${inTheWay[0].title}". Move ${inTheWay.length === 1 ? 'it' : 'them'} first.`);
  }
  return ok({
    id: ignoreId ?? uid('block'),
    kind: input.kind,
    label: input.label?.trim() || defaultBlockLabel(input.kind),
    start: fromMinutes(start),
    end: fromMinutes(end),
  });
}

const withBlocks = (data: ScheduleData, date: string, blocks: TimeBlock[]): ScheduleData => ({ ...data, dayBlocks: { ...data.dayBlocks, [date]: blocks } });

export function addBlock(data: ScheduleData, ctx: ScheduleContext, date: string, input: BlockInput): Result<ScheduleData> {
  const checked = checkBlock(data, ctx, date, input);
  if (checked.ok === false) return checked;
  return ok(withBlocks(data, date, [...blocksFor(data, date), checked.data]));
}

export function updateBlock(data: ScheduleData, ctx: ScheduleContext, date: string, id: string, patch: Partial<BlockInput>): Result<ScheduleData> {
  const current = blocksFor(data, date).find((b) => b.id === id);
  if (!current) return fail('That block no longer exists.');
  const merged = { kind: patch.kind ?? current.kind, label: patch.label ?? current.label, start: patch.start ?? current.start, end: patch.end ?? current.end };
  const checked = checkBlock(data, ctx, date, merged, id);
  if (checked.ok === false) return checked;
  if (current.kind === 'slot') {
    // A slot that shrinks or changes kind must not leave sessions stranded.
    const stranded = sessionsIn(data, date, toMinutes(current.start), toMinutes(current.end)).filter((s) => {
      const a = toMinutes(s.startTime as string);
      return merged.kind !== 'slot' || a < toMinutes(merged.start) || a + s.durationMinutes > toMinutes(merged.end);
    });
    if (stranded.length > 0) return fail(`"${stranded[0].title}" is in that slot. Move it first.`);
  }
  return ok(withBlocks(data, date, blocksFor(data, date).map((b) => (b.id === id ? checked.data : b))));
}

export function removeBlock(data: ScheduleData, date: string, id: string): Result<ScheduleData> {
  const current = blocksFor(data, date).find((b) => b.id === id);
  if (!current) return ok(data);
  if (current.kind === 'slot') {
    const inside = sessionsIn(data, date, toMinutes(current.start), toMinutes(current.end));
    if (inside.length > 0) return fail(`"${inside[0].title}" is in that slot. Move it first.`);
  }
  return ok(withBlocks(data, date, blocksFor(data, date).filter((b) => b.id !== id)));
}

/** Gives other days the same structure as this one: handy when breaks and lunch fall at the same time every day. */
export function copyBlocks(data: ScheduleData, fromDate: string, toDates: string[]): Result<ScheduleData> {
  const source = blocksFor(data, fromDate);
  let next = data;
  for (const date of toDates) {
    if (date === fromDate) continue;
    const bad = source.find((b) => sessionsIn(next, date, toMinutes(b.start), toMinutes(b.end)).length > 0 && b.kind !== 'slot');
    if (bad) return fail(`Sessions are already scheduled during ${bad.label} on ${date}. Move them first.`);
    next = withBlocks(next, date, source.map((b) => ({ ...b, id: uid('block') })));
  }
  return ok(next);
}

/** Adds session slots of a set length into every gap between the other blocks, so a day is quick to lay out. */
export function fillSlots(data: ScheduleData, ctx: ScheduleContext, date: string, minutes: number): Result<ScheduleData> {
  const length = Math.max(15, Math.round(minutes));
  const w = dayWindow(data, ctx);
  const blocks = blocksFor(data, date);
  let cursor = w.start;
  const added: TimeBlock[] = [];
  const gaps: [number, number][] = [];
  for (const b of blocks) {
    const bs = toMinutes(b.start);
    if (bs > cursor) gaps.push([cursor, bs]);
    cursor = Math.max(cursor, toMinutes(b.end));
  }
  if (cursor < w.end) gaps.push([cursor, w.end]);
  for (const [from, to] of gaps) {
    for (let t = from; t < to; t += length) {
      const end = Math.min(t + length, to);
      if (end - t >= 15) added.push({ id: uid('block'), kind: 'slot', label: defaultBlockLabel('slot'), start: fromMinutes(t), end: fromMinutes(end) });
    }
  }
  if (added.length === 0) return fail('There are no gaps to fill.');
  return ok(withBlocks(data, date, [...blocks, ...added]));
}

/** Adjacent slots count as one stretch, so a session may run across the join between two of them. */
export function openStretches(data: ScheduleData, date: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  for (const b of blocksFor(data, date).filter((x) => x.kind === 'slot')) {
    const start = toMinutes(b.start);
    const end = toMinutes(b.end);
    const last = out[out.length - 1];
    if (last && last.end === start) last.end = end;
    else out.push({ start, end });
  }
  return out;
}

/** Why a session cannot go at this time on this day, or null if it can. Fixed sessions only have to be inside the day. */
export function timeProblem(data: ScheduleData, ctx: ScheduleContext, date: string, start: number, end: number, fixed: boolean): string | null {
  const w = dayWindow(data, ctx);
  if (start < w.start || end > w.end) return `That is outside the day's hours (${w.startText} to ${w.endText}).`;
  if (fixed) return null;
  const blocked = blocksFor(data, date).find((b) => b.kind !== 'slot' && overlaps(start, end, toMinutes(b.start), toMinutes(b.end)));
  if (blocked) return `That is during ${blocked.label} (${blocked.start} to ${blocked.end}).`;
  const stretches = openStretches(data, date);
  if (stretches.length > 0 && !stretches.some((x) => start >= x.start && end <= x.end)) {
    const here = stretches.find((x) => start >= x.start && start < x.end);
    return here
      ? `${end - start} minutes does not fit there: the open time runs ${fromMinutes(here.start)} to ${fromMinutes(here.end)}.`
      : 'Sessions on this day go in the session slots. That time is between them.';
  }
  return null;
}

/** The session slot a time falls in, if the day has one there. */
export const slotAt = (data: ScheduleData, date: string, minutes: number): TimeBlock | undefined =>
  blocksFor(data, date).find((b) => b.kind === 'slot' && minutes >= toMinutes(b.start) && minutes < toMinutes(b.end));

/** Where a dropped session starts: the slot the pointer is in, else the nearest grid line. */
export function snapStart(data: ScheduleData, date: string, rawMinutes: number, slotMinutes: number, dayStartMin: number): number {
  const slot = blocksFor(data, date).find((b) => b.kind === 'slot' && rawMinutes >= toMinutes(b.start) && rawMinutes < toMinutes(b.end));
  if (slot) return toMinutes(slot.start);
  return dayStartMin + Math.round((rawMinutes - dayStartMin) / slotMinutes) * slotMinutes;
}

/**
 * A room is normally in one layout for a whole day, so a session takes its layout from the
 * room's setup for that day. Without one, the room's first layout is assumed.
 */
export function dayLayoutId(data: ScheduleData, date?: string, spaceId?: string): string | undefined {
  if (!date || !spaceId) return undefined;
  const space = getSpace(data, spaceId);
  if (!space) return undefined;
  const set = data.daySetups[date]?.[spaceId];
  if (set && (space.capacities[set] ?? 0) > 0) return set;
  return layoutsFor(data, spaceId)[0]?.layout.id;
}

export const isDayLayoutSet = (data: ScheduleData, date: string, spaceId: string): boolean => {
  const set = data.daySetups[date]?.[spaceId];
  return !!set && (getSpace(data, spaceId)?.capacities[set] ?? 0) > 0;
};

/** The layout in force for a session: its own choice, else the room's setup for the day. */
export function effectiveLayoutId(data: ScheduleData, s: ScheduleSession): string | undefined {
  if (s.layoutId && (getSpace(data, s.spaceId)?.capacities[s.layoutId] ?? 0) > 0) return s.layoutId;
  return dayLayoutId(data, s.date, s.spaceId);
}

export function setDayLayout(data: ScheduleData, date: string, spaceId: string, layoutId: string | null): Result<ScheduleData> {
  const space = getSpace(data, spaceId);
  if (!space) return fail('That room no longer exists.');
  if (layoutId !== null && (space.capacities[layoutId] ?? 0) <= 0) return fail(`${space.name} does not offer that layout.`);
  const day = { ...(data.daySetups[date] ?? {}) };
  if (layoutId === null) delete day[spaceId];
  else day[spaceId] = layoutId;
  return ok({ ...data, daySetups: { ...data.daySetups, [date]: day } });
}

/** Sets the same layout for a room on every day at once. */
export function setLayoutForAllDays(data: ScheduleData, dates: string[], spaceId: string, layoutId: string): Result<ScheduleData> {
  let next = data;
  for (const d of dates) {
    const r = setDayLayout(next, d, spaceId, layoutId);
    if (r.ok === false) return r;
    next = r.data;
  }
  return ok(next);
}

/* ------------------------------------------------------------------ */
/* Placement and clashes                                               */
/* ------------------------------------------------------------------ */

export interface ScheduleContext {
  keynotes: KeynoteBlock[];
  /** When given, sessions can only be placed on these days. */
  eventDates?: string[];
  /** The event's own daily hours, HH:MM. The agenda covers these unless the schedule says otherwise. */
  eventHours?: { start: string; end: string };
}

interface Occupant {
  id: string;
  kind: 'session' | 'keynote';
  title: string;
  roomIds: string[];
  date: string;
  start: number;
  end: number;
}

function occupants(data: ScheduleData, ctx: ScheduleContext, excludeId?: string): Occupant[] {
  const out: Occupant[] = [];
  for (const s of data.sessions) {
    if (s.id === excludeId || !isScheduled(s)) continue;
    const space = getSpace(data, s.spaceId);
    if (!space) continue;
    const start = toMinutes(s.startTime as string);
    out.push({ id: s.id, kind: 'session', title: s.title, roomIds: space.roomIds, date: s.date as string, start, end: start + s.durationMinutes });
  }
  for (const k of ctx.keynotes) {
    if (k.id === excludeId) continue;
    const space = getSpace(data, k.spaceId);
    if (!space) continue;
    out.push({ id: k.id, kind: 'keynote', title: k.title, roomIds: space.roomIds, date: k.date, start: toMinutes(k.startTime), end: toMinutes(k.endTime) });
  }
  return out;
}

export function findRoomClash(
  data: ScheduleData,
  ctx: ScheduleContext,
  where: { spaceId: string; date: string; start: number; end: number },
  excludeId?: string
): { title: string; start: string; end: string; rooms: string[] } | null {
  const space = getSpace(data, where.spaceId);
  if (!space) return null;
  const clash = occupants(data, ctx, excludeId).find(
    (o) => o.date === where.date && overlaps(where.start, where.end, o.start, o.end) && o.roomIds.some((r) => space.roomIds.includes(r))
  );
  if (!clash) return null;
  const rooms = clash.roomIds.filter((r) => space.roomIds.includes(r)).map((r) => data.rooms.find((x) => x.id === r)?.name ?? r);
  return { title: clash.title, start: fromMinutes(clash.start), end: fromMinutes(clash.end), rooms };
}

export interface Warning {
  kind: 'speaker' | 'capacity' | 'layout';
  message: string;
}

export interface PlacementTarget {
  spaceId: string;
  date: string;
  startTime: string;
  layoutId?: string;
}

interface SpeakerBusy {
  speakerId: string;
  title: string;
  date: string;
  start: number;
  end: number;
}

function speakerBusy(data: ScheduleData, ctx: ScheduleContext, excludeId?: string): SpeakerBusy[] {
  const out: SpeakerBusy[] = [];
  for (const s of data.sessions) {
    if (s.id === excludeId || !isScheduled(s)) continue;
    const start = toMinutes(s.startTime as string);
    for (const sp of s.speakers) out.push({ speakerId: sp.id, title: s.title, date: s.date as string, start, end: start + s.durationMinutes });
  }
  for (const k of ctx.keynotes) {
    if (k.id === excludeId) continue;
    for (const w of k.speakerWindows) out.push({ speakerId: w.speakerId, title: k.title, date: k.date, start: toMinutes(w.start), end: toMinutes(w.end) });
  }
  return out;
}

function checks(data: ScheduleData, ctx: ScheduleContext, session: ScheduleSession, excludeId: string): Warning[] {
  const warnings: Warning[] = [];
  const start = toMinutes(session.startTime as string);
  const end = start + session.durationMinutes;

  const busy = speakerBusy(data, ctx, excludeId);
  for (const sp of session.speakers) {
    const other = busy.find((b) => b.speakerId === sp.id && b.date === session.date && overlaps(start, end, b.start, b.end));
    if (other) {
      warnings.push({ kind: 'speaker', message: `${sp.name} is also in "${other.title}", ${fromMinutes(other.start)} to ${fromMinutes(other.end)}.` });
    }
  }

  const layoutId = effectiveLayoutId(data, session);
  const cap = capacityFor(data, session.spaceId, layoutId);
  if (session.expectedAttendance && cap !== undefined && session.expectedAttendance > cap) {
    const name = data.layouts.find((l) => l.id === layoutId)?.name;
    warnings.push({ kind: 'capacity', message: `Expects ${session.expectedAttendance} people but the room seats ${cap}${name ? ` in ${name}` : ' in that layout'}.` });
  }
  return warnings;
}

/**
 * Checks a placement and, if it is allowed, returns the schedule with the session in place.
 * A room that is already booked is an error. A speaker double-booked, or a room too small,
 * is only a warning: the planner decides.
 */
export function placeSession(data: ScheduleData, ctx: ScheduleContext, sessionId: string, target: PlacementTarget): Result<{ data: ScheduleData; warnings: Warning[] }> {
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return fail('That session no longer exists.');
  const space = getSpace(data, target.spaceId);
  if (!space) return fail('That room no longer exists.');

  const start = toMinutes(target.startTime);
  if (Number.isNaN(start)) return fail('Enter a start time such as 09:30.');
  const end = start + session.durationMinutes;

  const problem = timeProblem(data, ctx, target.date, start, end, !!session.fixed);
  if (problem) return fail(problem);
  if (ctx.eventDates && !ctx.eventDates.includes(target.date)) return fail('That date is outside the event.');

  const clash = findRoomClash(data, ctx, { spaceId: target.spaceId, date: target.date, start, end }, sessionId);
  if (clash) {
    return fail(`${clash.rooms.join(' and ')} is already booked ${clash.start} to ${clash.end} for "${clash.title}".`);
  }

  const warnings: Warning[] = [];
  let layoutId = target.layoutId ?? session.layoutId;
  if (layoutId && (space.capacities[layoutId] ?? 0) <= 0) {
    const name = data.layouts.find((l) => l.id === layoutId)?.name ?? 'That layout';
    warnings.push({ kind: 'layout', message: `${space.name} does not offer ${name}, so the layout was cleared.` });
    layoutId = undefined;
  }

  const placed: ScheduleSession = { ...session, spaceId: target.spaceId, layoutId, date: target.date, startTime: fromMinutes(start) };
  warnings.push(...checks(data, ctx, placed, sessionId));
  return ok({ data: updateSession(data, sessionId, { spaceId: placed.spaceId, layoutId, date: placed.date, startTime: placed.startTime }), warnings });
}

/** Changes how long a session runs. A placed session must still fit: it cannot grow into the next booking. */
export function resizeSession(data: ScheduleData, ctx: ScheduleContext, sessionId: string, minutes: number): Result<{ data: ScheduleData; warnings: Warning[] }> {
  const s = data.sessions.find((x) => x.id === sessionId);
  if (!s) return fail('That session no longer exists.');
  const resized = updateSession(data, sessionId, { durationMinutes: clampDuration(minutes) });
  if (!isScheduled(s)) return ok({ data: resized, warnings: [] });
  return placeSession(resized, ctx, sessionId, { spaceId: s.spaceId as string, date: s.date as string, startTime: s.startTime as string });
}

/** What is worth knowing about one placed session right now: speaker clashes and room size. */
export function sessionWarnings(data: ScheduleData, ctx: ScheduleContext, sessionId: string): Warning[] {
  const s = data.sessions.find((x) => x.id === sessionId);
  return s && isScheduled(s) ? checks(data, ctx, s, sessionId) : [];
}

/** Moves a placed session by some minutes, for keyboard control. */
export function nudgeSession(data: ScheduleData, ctx: ScheduleContext, sessionId: string, deltaMinutes: number) {
  const s = data.sessions.find((x) => x.id === sessionId);
  if (!s || !isScheduled(s)) return fail('Place the session on the agenda first.');
  if (s.fixed) return fail('That session is fixed in place. Unfix it to move it.');
  return placeSession(data, ctx, sessionId, {
    spaceId: s.spaceId as string,
    date: s.date as string,
    startTime: fromMinutes(toMinutes(s.startTime as string) + deltaMinutes),
  });
}

/** Changes a session's room. A scheduled session keeps its time if the new room is free then. */
export function assignSpace(data: ScheduleData, ctx: ScheduleContext, sessionId: string, spaceId: string | undefined): Result<{ data: ScheduleData; warnings: Warning[] }> {
  const s = data.sessions.find((x) => x.id === sessionId);
  if (!s) return fail('That session no longer exists.');
  if (!spaceId) return ok({ data: updateSession(unplaceSession(data, sessionId), sessionId, { spaceId: undefined, layoutId: undefined }), warnings: [] });
  if (isScheduled(s)) return placeSession(data, ctx, sessionId, { spaceId, date: s.date as string, startTime: s.startTime as string });
  const space = getSpace(data, spaceId);
  if (!space) return fail('That room no longer exists.');
  const keep = s.layoutId && (space.capacities[s.layoutId] ?? 0) > 0 ? s.layoutId : undefined;
  return ok({ data: updateSession(data, sessionId, { spaceId, layoutId: keep }), warnings: [] });
}

/* ------------------------------------------------------------------ */
/* Whole-schedule analysis                                             */
/* ------------------------------------------------------------------ */

export interface Analysis {
  unscheduled: ScheduleSession[];
  withoutSpeakers: ScheduleSession[];
  speakerClashes: { speaker: string; a: string; b: string }[];
  overCapacity: { session: ScheduleSession; attendance: number; capacity: number }[];
  /** Placed in a room or layout that has since been removed. */
  orphaned: ScheduleSession[];
  roomClashes: { a: string; b: string }[];
}

export function analyseSchedule(data: ScheduleData, ctx: ScheduleContext): Analysis {
  const scheduled = data.sessions.filter(isScheduled);
  const analysis: Analysis = {
    unscheduled: data.sessions.filter((s) => !isScheduled(s)),
    withoutSpeakers: data.sessions.filter((s) => s.speakers.length === 0),
    speakerClashes: [],
    overCapacity: [],
    orphaned: scheduled.filter((s) => !getSpace(data, s.spaceId)),
    roomClashes: [],
  };

  const seen = new Set<string>();
  const addSpeakerClash = (speaker: string, a: string, b: string, key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    analysis.speakerClashes.push({ speaker, a, b });
  };

  // Earliest first, so each pair is looked at once and always reads "earlier, later".
  const ordered = [...scheduled].sort((x, y) =>
    `${x.date} ${x.startTime} ${x.id}`.localeCompare(`${y.date} ${y.startTime} ${y.id}`)
  );
  ordered.forEach((s, i) => {
    const start = toMinutes(s.startTime as string);
    const end = start + s.durationMinutes;
    for (const other of ordered.slice(i + 1)) {
      if (other.date !== s.date) continue;
      const os = toMinutes(other.startTime as string);
      if (!overlaps(start, end, os, os + other.durationMinutes)) continue;
      for (const sp of s.speakers) {
        if (other.speakers.some((x) => x.id === sp.id)) addSpeakerClash(sp.name, s.title, other.title, `${sp.id}|${s.id}|${other.id}`);
      }
      const a = getSpace(data, s.spaceId);
      const b = getSpace(data, other.spaceId);
      if (a && b && a.roomIds.some((r) => b.roomIds.includes(r))) analysis.roomClashes.push({ a: s.title, b: other.title });
    }
    for (const k of ctx.keynotes) {
      if (k.date !== s.date) continue;
      for (const w of k.speakerWindows) {
        if (s.speakers.some((x) => x.id === w.speakerId) && overlaps(start, end, toMinutes(w.start), toMinutes(w.end))) {
          addSpeakerClash(w.speakerName, s.title, k.title, `${w.speakerId}|${s.id}|${k.id}`);
        }
      }
    }
    const cap = capacityFor(data, s.spaceId, effectiveLayoutId(data, s));
    if (s.expectedAttendance && cap !== undefined && s.expectedAttendance > cap) {
      analysis.overCapacity.push({ session: s, attendance: s.expectedAttendance, capacity: cap });
    }
  });
  return analysis;
}

export function scheduleSummary(data: ScheduleData, ctx: ScheduleContext): ModuleSummary {
  const id = 'schedule';
  const hasRooms = data.rooms.length > 0;
  const keynotes = ctx.keynotes.length;
  if (!hasRooms && data.sessions.length === 0) {
    return { moduleId: id, state: 'not_started', headline: 'No rooms or sessions yet', attention: [] };
  }

  const a = analyseSchedule(data, ctx);
  const attention: ModuleAttentionItem[] = [];
  if (a.roomClashes.length > 0) attention.push({ label: `${plural(a.roomClashes.length, 'room is', 'rooms are')} double-booked`, severity: 'critical' });
  if (a.orphaned.length > 0) attention.push({ label: `${plural(a.orphaned.length, 'session is', 'sessions are')} in a room that was removed`, severity: 'critical' });
  if (a.speakerClashes.length > 0) attention.push({ label: `${plural(a.speakerClashes.length, 'stakeholder is', 'stakeholders are')} double-booked`, severity: 'warning' });
  if (a.overCapacity.length > 0) attention.push({ label: `${plural(a.overCapacity.length, 'session is', 'sessions are')} over room capacity`, severity: 'warning' });
  if (a.unscheduled.length > 0) attention.push({ label: `${plural(a.unscheduled.length, 'session is', 'sessions are')} not on the agenda yet`, severity: 'warning' });
  if (a.withoutSpeakers.length > 0) attention.push({ label: `${plural(a.withoutSpeakers.length, 'session has', 'sessions have')} no stakeholder`, severity: 'warning' });
  if (!hasRooms) attention.push({ label: 'No rooms have been added', severity: 'warning' });

  const total = data.sessions.length;
  const placed = total - a.unscheduled.length;
  const external = data.sessions.filter((s) => s.origin === 'external').length;
  const headline =
    `${plural(total, 'session', 'sessions')}${external > 0 ? ` (${total - external} internal, ${external} external)` : ''}, ${placed} on the agenda` +
    ` \u00b7 ${plural(data.rooms.length, 'room', 'rooms')}` +
    (keynotes > 0 ? ` \u00b7 ${plural(keynotes, 'keynote', 'keynotes')} placed` : '');
  const state = attention.length > 0 ? 'needs_attention' : total > 0 && a.unscheduled.length === 0 ? 'complete' : 'in_progress';
  return { moduleId: id, state, headline, attention };
}
