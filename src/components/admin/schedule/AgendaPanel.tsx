import React, { useMemo, useRef, useState } from 'react';
import { AlertTriangle, GripVertical, Lock, Plus, Presentation } from 'lucide-react';
import type { KeyStakeholder } from '@/types';
import type { ScheduleData, ScheduleSession, SessionOrigin, Space } from '@/types/schedule';
import {
  allTags,
  analyseSchedule,
  blocksFor,
  dayLayoutId,
  dayWindow,
  effectiveLayoutId,
  findRoomClash,
  fromMinutes,
  getSpace,
  isDayLayoutSet,
  isScheduled,
  layoutsFor,
  listSpaces,
  placeSession,
  sessionEnd,
  sessionLabel,
  sessionWarnings,
  slotAt,
  timeProblem,
  toMinutes,
} from '@/lib/schedule';
import type { PlacementTarget, ScheduleContext } from '@/lib/schedule';
import { formatDate } from '@/lib/utils';
import { formFieldClass } from '@/components/common/StakeholderSelect';
import { toast } from '@/components/common/Toast';
import { BLOCK_STYLE, FIXED_STYLE, ORIGIN_STYLE } from './originStyle';

export const PX_PER_MIN = 1.5;
export const GUTTER = 56;
/** The grid shows this much before and after the day's hours, so the first and last times are not on the very edge. */
export const VIEW_PADDING_MIN = 60;
const COLUMN_MIN = 150;

/** Which room column and which time a pointer position means. */
export function locatePointer(args: {
  clientX: number;
  clientY: number;
  rect: { left: number; top: number; width: number };
  roomCount: number;
  dayStartMin: number;
  slotMinutes: number;
  /** How far down the dragged block the pointer grabbed it, in minutes. */
  grabOffsetMin: number;
  /**
   * Chooses the start time from where the pointer is and where the block's top would be.
   * Without it the time snaps to the nearest grid line.
   */
  snap?: (pointerMin: number, topMin: number) => number;
}): { column: number; startMin: number } {
  const { clientX, clientY, rect, roomCount, dayStartMin, slotMinutes, grabOffsetMin, snap } = args;
  const colWidth = Math.max(1, (rect.width - GUTTER) / Math.max(1, roomCount));
  const column = Math.min(roomCount - 1, Math.max(0, Math.floor((clientX - rect.left - GUTTER) / colWidth)));
  const pointerMin = dayStartMin + (clientY - rect.top) / PX_PER_MIN;
  const topMin = pointerMin - grabOffsetMin;
  const startMin = snap ? snap(pointerMin, topMin) : dayStartMin + Math.round((topMin - dayStartMin) / slotMinutes) * slotMinutes;
  return { column, startMin };
}

interface Ghost {
  spaceId: string;
  startMin: number;
  durationMin: number;
  ok: boolean;
  reason: string;
}

interface DragState {
  kind: 'session' | 'keynote';
  id: string;
  grabOffsetMin: number;
}

interface AgendaPanelProps {
  data: ScheduleData;
  ctx: ScheduleContext;
  days: string[];
  stakeholders: KeyStakeholder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPlace: (sessionId: string, target: PlacementTarget) => boolean;
  onNudge: (sessionId: string, deltaMinutes: number) => void;
  onMoveKeynote: (keynoteId: string, date: string, startTime: string) => boolean;
  onAddSession: (input: { title: string; spaceId?: string; durationMinutes: number; origin: SessionOrigin }) => string | null;
  onSetDayLayout: (date: string, spaceId: string, layoutId: string | null) => void;
  onGoToRooms: () => void;
  /** The editor for the selected session, shown under the grid. */
  children?: React.ReactNode;
}

const dayLabel = (iso: string) => formatDate(iso).replace(/,? \d{4}$/, '');

export const AgendaPanel: React.FC<AgendaPanelProps> = ({
  data, ctx, days, stakeholders, selectedId, onSelect, onPlace, onNudge, onMoveKeynote, onAddSession, onSetDayLayout, onGoToRooms, children,
}) => {
  const [day, setDay] = useState(days[0] ?? '');
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const drag = useRef<DragState | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [quickTitle, setQuickTitle] = useState('');
  const [quickSpace, setQuickSpace] = useState('');
  const [quickLength, setQuickLength] = useState(45);
  const [quickOrigin, setQuickOrigin] = useState<SessionOrigin>('internal');
  const [filterOrigin, setFilterOrigin] = useState<'all' | SessionOrigin>('all');
  const [filterTag, setFilterTag] = useState('');

  const { rooms, settings } = data;
  const window_ = dayWindow(data, ctx);
  const dayStartMin = window_.start;
  const dayEndMin = window_.end;
  // What is drawn runs an hour either side of the day. Dropping there is still refused: it is outside the day's hours.
  const viewStartMin = Math.max(0, dayStartMin - VIEW_PADDING_MIN);
  const viewEndMin = Math.min(24 * 60, dayEndMin + VIEW_PADDING_MIN);
  const totalMin = Math.max(settings.slotMinutes, viewEndMin - viewStartMin);
  const spaces = useMemo(() => listSpaces(data), [data]);
  const analysis = useMemo(() => analyseSchedule(data, ctx), [data, ctx]);
  const tags = useMemo(() => allTags(data), [data]);
  const nameOf = (id: string, fallback: string) => {
    const s = stakeholders.find((x) => x.id === id);
    return s ? `${s.firstName} ${s.lastName}`.trim() : fallback;
  };

  const activeDay = days.includes(day) ? day : (days[0] ?? '');
  const blocks = blocksFor(data, activeDay);
  const matches = (s: ScheduleSession) => (filterOrigin === 'all' || s.origin === filterOrigin) && (!filterTag || s.tags.some((t) => t.toLowerCase() === filterTag.toLowerCase()));
  const filtering = filterOrigin !== 'all' || !!filterTag;
  const placedToday = data.sessions.filter((s) => isScheduled(s) && s.date === activeDay);
  const keynotesToday = ctx.keynotes.filter((k) => k.date === activeDay);
  const tray = data.sessions.filter((s) => !isScheduled(s) && matches(s));

  const columnsOf = (space?: Space): { start: number; span: number } | null => {
    if (!space) return null;
    const idx = space.roomIds.map((id) => rooms.findIndex((r) => r.id === id));
    if (idx.some((i) => i < 0)) return null;
    const start = Math.min(...idx);
    return { start, span: Math.max(...idx) - start + 1 };
  };

  /* ---------------- drag and drop ---------------- */

  const evaluate = (e: React.DragEvent): Ghost | null => {
    const d = drag.current;
    const body = bodyRef.current;
    if (!d || !body || rooms.length === 0 || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return null;
    const { column, startMin } = locatePointer({
      clientX: e.clientX, clientY: e.clientY, rect: body.getBoundingClientRect(), roomCount: rooms.length,
      dayStartMin: viewStartMin, slotMinutes: settings.slotMinutes, grabOffsetMin: d.grabOffsetMin,
      // Where the pointer is inside a session slot, the session lands at the start of that slot.
      snap: (pointerMin, topMin) => {
        const slot = slotAt(data, activeDay, pointerMin);
        return slot ? toMinutes(slot.start) : viewStartMin + Math.round((topMin - viewStartMin) / settings.slotMinutes) * settings.slotMinutes;
      },
    });
    if (!rooms[column]) return null;

    if (d.kind === 'session') {
      const session = data.sessions.find((s) => s.id === d.id);
      if (!session) return null;
      // A joined-room session dropped on one of its own rooms stays joined; anything else lands in that room.
      const current = getSpace(data, session.spaceId);
      const spaceId = current && current.roomIds.includes(rooms[column].id) ? current.id : rooms[column].id;
      const result = placeSession(data, ctx, session.id, { spaceId, date: activeDay, startTime: fromMinutes(startMin) });
      return {
        spaceId, startMin, durationMin: session.durationMinutes, ok: result.ok === true,
        reason: result.ok === true ? (result.data.warnings[0]?.message ?? '') : (result as { error: string }).error,
      };
    }

    const block = ctx.keynotes.find((k) => k.id === d.id);
    if (!block) return null;
    const durationMin = toMinutes(block.endTime) - toMinutes(block.startTime);
    const end = startMin + durationMin;
    // A keynote or general session is fixed by nature: it may run through breaks, but must stay in the day.
    const problem = timeProblem(data, ctx, activeDay, startMin, end, true);
    if (problem) return { spaceId: block.spaceId, startMin, durationMin, ok: false, reason: problem };
    const clash = findRoomClash(data, ctx, { spaceId: block.spaceId, date: activeDay, start: startMin, end }, block.id);
    return {
      spaceId: block.spaceId, startMin, durationMin, ok: !clash,
      reason: clash ? `${clash.rooms.join(' and ')} is already booked ${clash.start} to ${clash.end} for "${clash.title}".` : '',
    };
  };

  const startDrag = (e: React.DragEvent, kind: DragState['kind'], id: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    drag.current = { kind, id, grabOffsetMin: kind === 'session' && rect.height > 0 ? Math.max(0, (e.clientY - rect.top) / PX_PER_MIN) : 0 };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const endDrag = () => {
    drag.current = null;
    setGhost(null);
  };

  const onDragOver = (e: React.DragEvent) => {
    if (!drag.current) return;
    e.preventDefault();
    const g = evaluate(e);
    e.dataTransfer.dropEffect = g?.ok ? 'move' : 'none';
    setGhost(g);
  };

  const onDrop = (e: React.DragEvent) => {
    const d = drag.current;
    if (!d) return;
    e.preventDefault();
    const g = evaluate(e);
    endDrag();
    if (!g) return;
    if (!g.ok) {
      toast.error(g.reason, 'Cannot place here');
      return;
    }
    if (d.kind === 'session') onPlace(d.id, { spaceId: g.spaceId, date: activeDay, startTime: fromMinutes(g.startMin) });
    else onMoveKeynote(d.id, activeDay, fromMinutes(g.startMin));
  };

  /* ---------------- rendering ---------------- */

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded border border-dashed border-[#c5ccd3] bg-white px-4 py-12 text-center">
        <Presentation className="h-5 w-5 text-[#5b6770]" aria-hidden="true" />
        <p className="text-xs font-semibold text-[#252a2e]">No rooms yet</p>
        <p className="max-w-sm text-[11px] text-[#5b6770]">Add the rooms you have, their layouts and capacities, and the agenda grid appears here.</p>
        <button type="button" onClick={onGoToRooms} className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#005084]">
          Set up rooms
        </button>
      </div>
    );
  }

  const hours: number[] = [];
  for (let m = Math.ceil(viewStartMin / 60) * 60; m <= viewEndMin; m += 60) hours.push(m);
  const gridTemplate = `${GUTTER}px repeat(${rooms.length}, minmax(0, 1fr))`;
  const top = (min: number) => (min - viewStartMin) * PX_PER_MIN;

  const groups: { key: string; name: string; sessions: ScheduleSession[] }[] = [
    { key: '__none', name: 'No room yet', sessions: tray.filter((s) => !getSpace(data, s.spaceId)) },
    ...spaces.map((sp) => ({ key: sp.id, name: sp.name, sessions: tray.filter((s) => s.spaceId === sp.id) })),
  ].filter((g) => g.sessions.length > 0);

  const submitQuick = (e: React.FormEvent) => {
    e.preventDefault();
    const id = onAddSession({ title: quickTitle, spaceId: quickSpace || undefined, durationMinutes: quickLength, origin: quickOrigin });
    if (id) {
      setQuickTitle('');
      onSelect(id);
    }
  };

  const chip = (n: number, one: string, many: string, tone: 'warn' | 'crit') =>
    n > 0 && (
      <span key={one} className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${tone === 'crit' ? 'border-[#f2b8b5] bg-[#fdecec] text-[#9e1b16]' : 'border-[#f1d68c] bg-[#fef3d6] text-[#6e4600]'}`}>
        {n} {n === 1 ? one : many}
      </span>
    );

  const stakeholderLine = (s: ScheduleSession) =>
    [...s.speakers.map((x) => nameOf(x.id, x.name)), ...(s.guests ? [s.guests] : [])].join(', ');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Day" className="flex flex-wrap gap-1">
          {days.map((d, i) => {
            const count = data.sessions.filter((s) => isScheduled(s) && s.date === d).length;
            return (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={d === activeDay}
                tabIndex={d === activeDay ? 0 : -1}
                onClick={() => setDay(d)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') setDay(days[(i + 1) % days.length]);
                  if (e.key === 'ArrowLeft') setDay(days[(i + days.length - 1) % days.length]);
                }}
                className={`focus-ring cursor-pointer rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                  d === activeDay ? 'bg-[#0063a3] text-white' : 'border border-[#d8dce0] bg-white text-[#46535e] hover:border-[#0063a3] hover:text-[#0063a3]'
                }`}
              >
                {dayLabel(d)} <span className="font-mono tabular-nums opacity-80">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="status">
          {chip(analysis.roomClashes.length, 'room clash', 'room clashes', 'crit')}
          {chip(analysis.speakerClashes.length, 'stakeholder clash', 'stakeholder clashes', 'warn')}
          {chip(analysis.overCapacity.length, 'over capacity', 'over capacity', 'warn')}
          {chip(analysis.unscheduled.length, 'not on the agenda', 'not on the agenda', 'warn')}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <label className="flex items-center gap-1.5 text-[#46535e]">
          Show
          <select aria-label="Filter by origin" value={filterOrigin} onChange={(e) => setFilterOrigin(e.target.value as 'all' | SessionOrigin)} className={`${formFieldClass} w-32 cursor-pointer`}>
            <option value="all">All sessions</option>
            <option value="internal">Internal only</option>
            <option value="external">External only</option>
          </select>
        </label>
        {tags.length > 0 && (
          <label className="flex items-center gap-1.5 text-[#46535e]">
            Tag
            <select aria-label="Filter by tag" value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className={`${formFieldClass} w-40 cursor-pointer`}>
              <option value="">Any tag</option>
              {tags.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        )}
        <ul className="flex flex-wrap items-center gap-3 text-[11px] text-[#46535e]" aria-label="Key to the colours">
          {(['internal', 'external'] as const).map((o) => (
            <li key={o} className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-sm border" style={{ background: ORIGIN_STYLE[o].bg, borderColor: ORIGIN_STYLE[o].border }} aria-hidden="true" />
              {ORIGIN_STYLE[o].label}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-dashed" style={{ background: FIXED_STYLE.bg, borderColor: FIXED_STYLE.border }} aria-hidden="true" />
            Fixed in place
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-[#14284b]" aria-hidden="true" />
            Keynote
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Tray: the board's "Not on schedule" */}
        <aside aria-label="Sessions not on the agenda" className="w-full shrink-0 space-y-3 lg:w-64">
          <form onSubmit={submitQuick} aria-label="Add a session" className="space-y-2 rounded border border-[#d8dce0] bg-white p-3 shadow-2xs">
            <label htmlFor="quick-title" className="block text-[11px] font-semibold text-[#252a2e]">New session</label>
            <input id="quick-title" type="text" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} placeholder="Title" className={formFieldClass} />
            <div className="flex gap-2">
              <select aria-label="Room for the new session" value={quickSpace} onChange={(e) => setQuickSpace(e.target.value)} className={`${formFieldClass} min-w-0 flex-1 cursor-pointer`}>
                <option value="">No room yet</option>
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <select aria-label="Length of the new session" value={quickLength} onChange={(e) => setQuickLength(Number(e.target.value))} className={`${formFieldClass} w-20 cursor-pointer`}>
                {[15, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
            <select aria-label="Origin of the new session" value={quickOrigin} onChange={(e) => setQuickOrigin(e.target.value as SessionOrigin)} className={`${formFieldClass} cursor-pointer`}>
              <option value="internal">Internal</option>
              <option value="external">External (customer or partner)</option>
            </select>
            <button type="submit" className="focus-ring flex w-full cursor-pointer items-center justify-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add session
            </button>
          </form>

          {groups.length === 0 ? (
            <p className="rounded border border-dashed border-[#c5ccd3] bg-white px-3 py-4 text-center text-[11px] text-[#5b6770]">
              {filtering ? 'Nothing waiting matches the filter.' : 'Every session is on the agenda.'}
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.key} aria-label={`Waiting for ${g.name}`}>
                <h2 className="mb-1 text-[11px] font-bold text-[#46535e]">{g.name}</h2>
                <ul className="space-y-1.5">
                  {g.sessions.map((s) => {
                    const o = ORIGIN_STYLE[s.origin];
                    return (
                      <li key={s.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          draggable
                          aria-pressed={selectedId === s.id}
                          aria-label={`${sessionLabel(s)}, ${s.origin}, ${s.durationMinutes} minutes. Drag onto the agenda, or press Enter to edit.`}
                          onDragStart={(e) => startDrag(e, 'session', s.id)}
                          onDragEnd={endDrag}
                          onClick={() => onSelect(s.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelect(s.id);
                            }
                          }}
                          className={`focus-ring flex cursor-grab items-start gap-1.5 rounded border px-2 py-1.5 text-xs shadow-2xs active:cursor-grabbing ${selectedId === s.id ? 'ring-2 ring-[#0063a3]' : ''}`}
                          style={s.fixed ? { background: FIXED_STYLE.bg, borderColor: FIXED_STYLE.border, borderStyle: 'dashed', color: FIXED_STYLE.text } : { background: o.bg, borderColor: o.border, color: o.text }}
                        >
                          <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block font-semibold leading-snug">{sessionLabel(s)}</span>
                            <span className="block text-[11px] opacity-90">
                              {o.label} &middot; {s.durationMinutes} min{s.fixed ? ' \u00b7 Fixed' : ''}
                            </span>
                            {stakeholderLine(s) && <span className="block truncate text-[11px] opacity-90">{stakeholderLine(s)}</span>}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </aside>

        {/* Grid */}
        <div className="min-w-0 flex-1">
          <div role="region" aria-label="Agenda grid" tabIndex={0} className="focus-ring max-h-[70vh] overflow-auto rounded border border-[#d8dce0] bg-white shadow-2xs">
            <div style={{ minWidth: GUTTER + rooms.length * COLUMN_MIN }}>
              <div className="sticky top-0 z-20 grid border-b border-[#d8dce0] bg-[#f8f9fa] text-[11px] text-[#252a2e]" style={{ gridTemplateColumns: gridTemplate }}>
                <div />
                {rooms.map((r) => {
                  const offered = layoutsFor(data, r.id);
                  const current = dayLayoutId(data, activeDay, r.id);
                  const explicit = isDayLayoutSet(data, activeDay, r.id);
                  return (
                    <div key={r.id} className="min-w-0 border-l border-[#e7eaef] px-2 py-1.5">
                      <div className="truncate font-semibold" title={r.name}>{r.name}</div>
                      {offered.length > 0 ? (
                        <select
                          aria-label={`${r.name} setup on ${dayLabel(activeDay)}`}
                          value={current ?? ''}
                          onChange={(e) => onSetDayLayout(activeDay, r.id, e.target.value || null)}
                          title={explicit ? 'How this room is set up all day' : 'Not set for this day: using the first layout the room offers'}
                          className="focus-ring mt-0.5 w-full cursor-pointer rounded border border-transparent bg-transparent px-0.5 py-0.5 text-[11px] text-[#46535e] hover:border-[#d8dce0] hover:bg-white"
                        >
                          {offered.map(({ layout, capacity }) => (
                            <option key={layout.id} value={layout.id}>
                              {layout.name} &middot; seats {capacity}{layout.id === current && !explicit ? ' (default)' : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="mt-0.5 text-[11px] text-[#5b6770]">No layouts set up</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                ref={bodyRef}
                data-testid="agenda-body"
                className="relative"
                style={{
                  height: totalMin * PX_PER_MIN,
                  backgroundImage: `repeating-linear-gradient(to bottom, #e7eaef 0, #e7eaef 1px, transparent 1px, transparent ${60 * PX_PER_MIN}px)`,
                }}
                onDragOver={onDragOver}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setGhost(null);
                }}
                onDrop={onDrop}
              >
                {hours.map((m) => (
                  <span
                    key={m}
                    aria-hidden="true"
                    className={`absolute left-0 bg-white px-1 font-mono text-[10px] tabular-nums text-[#5b6770] ${
                      m === viewStartMin ? 'translate-y-0.5' : m === viewEndMin ? '-translate-y-full -mt-0.5' : '-translate-y-1/2'
                    }`}
                    style={{ top: top(m), width: GUTTER - 4 }}
                  >
                    {fromMinutes(m)}
                  </span>
                ))}

                {/* The hours either side of the day are drawn, but sessions cannot go there. */}
                {dayStartMin > viewStartMin && (
                  <div
                    data-testid="outside-hours-before"
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 px-2 py-1 text-[10px] text-[#5b6770]"
                    style={{ left: GUTTER, top: 0, height: top(dayStartMin), background: 'repeating-linear-gradient(135deg, #f4f6f8 0 6px, #eaeef1 6px 7px)' }}
                  >
                    Before the day starts
                  </div>
                )}
                {dayEndMin < viewEndMin && (
                  <div
                    data-testid="outside-hours-after"
                    aria-hidden="true"
                    className="pointer-events-none absolute right-0 px-2 py-1 text-[10px] text-[#5b6770]"
                    style={{ left: GUTTER, top: top(dayEndMin), height: top(viewEndMin) - top(dayEndMin), background: 'repeating-linear-gradient(135deg, #f4f6f8 0 6px, #eaeef1 6px 7px)' }}
                  >
                    After the day ends
                  </div>
                )}

                {/* The day's structure: slots, breaks and all-attendee events run across every room. */}
                {blocks.map((b) => {
                  const start = toMinutes(b.start);
                  const height = (toMinutes(b.end) - start) * PX_PER_MIN;
                  const style = b.kind === 'slot' ? null : BLOCK_STYLE[b.kind];
                  return (
                    <div
                      key={b.id}
                      data-block-kind={b.kind}
                      className={`pointer-events-none absolute right-0 overflow-hidden px-2 py-1 text-[11px] leading-tight ${b.kind === 'slot' ? 'border-y border-dashed border-[#cdd6dc] bg-[#fafcfd]' : ''}`}
                      style={{ left: GUTTER, top: top(start), height, ...(style ? { background: style.bg, color: style.text } : { color: '#5b6770' }) }}
                    >
                      <span className={b.kind === 'slot' ? '' : 'font-semibold'}>{b.label}</span>
                      <span className="ml-1.5 font-mono text-[10px] tabular-nums opacity-80">{b.start}&ndash;{b.end}</span>
                      {b.kind !== 'slot' && <span className="sr-only">. No sessions here.</span>}
                    </div>
                  );
                })}

                <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: gridTemplate }} aria-hidden="true">
                  <div />
                  {rooms.map((r) => (
                    <div key={r.id} className="border-l border-[#e7eaef]" />
                  ))}
                </div>

                <div className="pointer-events-none absolute inset-0 grid" style={{ gridTemplateColumns: gridTemplate }}>
                  {placedToday.map((s) => {
                    const cols = columnsOf(getSpace(data, s.spaceId));
                    if (!cols) return null;
                    const start = toMinutes(s.startTime as string);
                    const space = getSpace(data, s.spaceId) as Space;
                    const warnings = sessionWarnings(data, ctx, s.id);
                    const selected = selectedId === s.id;
                    const layout = data.layouts.find((l) => l.id === effectiveLayoutId(data, s));
                    const height = Math.max(20, s.durationMinutes * PX_PER_MIN - 2);
                    const o = ORIGIN_STYLE[s.origin];
                    const who = stakeholderLine(s);
                    const dim = filtering && !matches(s);
                    const tone = s.fixed ? FIXED_STYLE : o;
                    return (
                      <div
                        key={s.id}
                        role="button"
                        tabIndex={0}
                        draggable={!s.fixed}
                        aria-pressed={selected}
                        aria-label={`${sessionLabel(s)}, ${o.label}${s.fixed ? ', fixed in place' : ''}, ${space.name}, ${s.startTime} to ${sessionEnd(s)}${who ? `, ${who}` : ''}${warnings.length ? `. ${warnings.length} thing${warnings.length === 1 ? '' : 's'} to check` : ''}. Press Enter to edit${s.fixed ? '.' : ', or Alt with the Up and Down arrows to move.'}`}
                        onDragStart={(e) => (s.fixed ? e.preventDefault() : startDrag(e, 'session', s.id))}
                        onDragEnd={endDrag}
                        onClick={() => onSelect(s.id)}
                        onKeyDown={(e) => {
                          if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                            e.preventDefault();
                            onNudge(s.id, e.key === 'ArrowUp' ? -settings.slotMinutes : settings.slotMinutes);
                          } else if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelect(s.id);
                          }
                        }}
                        className={`focus-ring pointer-events-auto mx-0.5 overflow-hidden rounded border px-1.5 py-1 text-left text-[11px] leading-tight shadow-xs transition-opacity ${s.fixed ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'} ${selected ? 'ring-2 ring-[#0063a3]' : ''} ${dim ? 'opacity-35' : ''}`}
                        style={{
                          gridColumn: `${cols.start + 2} / span ${cols.span}`, gridRow: 1, marginTop: top(start) + 1, height,
                          background: tone.bg, color: tone.text, borderColor: warnings.length && !s.fixed ? '#d99100' : tone.border, borderStyle: s.fixed ? 'dashed' : 'solid',
                        }}
                        title={warnings.map((w) => w.message).join('\n') || undefined}
                      >
                        <span className="flex items-start gap-1">
                          {s.fixed && <Lock className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />}
                          {warnings.length > 0 && <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-[#6e4600]" aria-hidden="true" />}
                          <span className="font-bold">{sessionLabel(s)}</span>
                        </span>
                        {height >= 36 && (
                          <span className="block font-mono text-[10px] tabular-nums opacity-90">
                            {s.startTime}&ndash;{sessionEnd(s)} &middot; {o.label}
                            {layout ? ` \u00b7 ${layout.name}` : ''}
                          </span>
                        )}
                        {height >= 54 && who && <span className="block truncate opacity-90">{who}</span>}
                        {height >= 70 && s.tags.length > 0 && <span className="block truncate text-[10px] opacity-80">{s.tags.join(' \u00b7 ')}</span>}
                      </div>
                    );
                  })}

                  {keynotesToday.map((k) => {
                    const cols = columnsOf(getSpace(data, k.spaceId));
                    if (!cols) return null;
                    const start = toMinutes(k.startTime);
                    const height = Math.max(20, (toMinutes(k.endTime) - start) * PX_PER_MIN - 2);
                    return (
                      <div
                        key={k.id}
                        role="group"
                        draggable
                        aria-label={`Keynote: ${k.title}, ${k.startTime} to ${k.endTime}. Drag to move it. Its room is set in Keynote and General Session.`}
                        onDragStart={(e) => startDrag(e, 'keynote', k.id)}
                        onDragEnd={endDrag}
                        className="pointer-events-auto mx-0.5 cursor-grab overflow-hidden rounded border border-[#0b1d3a] bg-[#14284b] px-1.5 py-1 text-left text-[11px] leading-tight text-white shadow-xs active:cursor-grabbing"
                        style={{ gridColumn: `${cols.start + 2} / span ${cols.span}`, gridRow: 1, marginTop: top(start) + 1, height }}
                        title="Keynote or general session. Its room is set in the Keynote module."
                      >
                        <span className="block font-bold">{k.title}</span>
                        {height >= 36 && <span className="block font-mono text-[10px] tabular-nums opacity-90">{k.startTime}&ndash;{k.endTime} &middot; Keynote</span>}
                      </div>
                    );
                  })}

                  {ghost && (() => {
                    const cols = columnsOf(getSpace(data, ghost.spaceId));
                    if (!cols) return null;
                    return (
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none mx-0.5 rounded border-2 border-dashed px-1.5 py-1 text-[11px] font-semibold ${ghost.ok ? 'border-[#00823b] bg-[#e6f5ec]/80 text-[#005a28]' : 'border-[#da3832] bg-[#fdecec]/85 text-[#9e1b16]'}`}
                        style={{ gridColumn: `${cols.start + 2} / span ${cols.span}`, gridRow: 1, marginTop: top(ghost.startMin), height: ghost.durationMin * PX_PER_MIN }}
                      >
                        {fromMinutes(ghost.startMin)}
                        {ghost.reason ? ` ${ghost.reason}` : ''}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {children}
    </div>
  );
};
