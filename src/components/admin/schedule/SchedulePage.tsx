import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarRange, X } from 'lucide-react';
import type { EventConfig, KeynoteSession } from '@/types';
import type { ScheduleData, ScheduleSession } from '@/types/schedule';
import { getDatesInRange } from '@/lib/matrix';
import { getKeynoteSessions, updateKeynoteSession } from '@/lib/keynote';
import { getStakeholders } from '@/lib/stakeholders';
import {
  assignSpace, createEmptySchedule, createSession, fromMinutes, getSpace, keynoteBlocks, normaliseSchedule, nudgeSession, placeSession,
  removeSession, resizeSession, SCHEDULE_MODULE_ID, setDayLayout, toMinutes, unplaceSession, updateSession,
} from '@/lib/schedule';
import type { PlacementTarget, ScheduleContext, SessionInput, Warning } from '@/lib/schedule';
import { usePageFocus } from '@/lib/hooks';
import { useModuleData } from '@/lib/useModuleData';
import { SaveStatus } from '@/components/common/SaveStatus';
import { toast } from '@/components/common/Toast';
import { AgendaPanel } from './AgendaPanel';
import { DayStructurePanel } from './DayStructurePanel';
import { RoomsPanel } from './RoomsPanel';
import { SessionEditor } from './SessionEditor';
import { SessionsPanel } from './SessionsPanel';

type Tab = 'agenda' | 'sessions' | 'rooms' | 'day';

interface SchedulePageProps {
  event: EventConfig;
  onBack: () => void;
  onManageStakeholders?: () => void;
}

export const SchedulePage: React.FC<SchedulePageProps> = ({ event, onBack, onManageStakeholders }) => {
  const modalRef = usePageFocus();
  const { data, commit, saveState } = useModuleData<ScheduleData>(
    event.id,
    SCHEDULE_MODULE_ID,
    createEmptySchedule,
    (raw) => normaliseSchedule(raw as Partial<ScheduleData>)
  );
  const stakeholders = useMemo(() => getStakeholders(event.id), [event.id]);
  const [keynoteSessions, setKeynoteSessions] = useState<KeynoteSession[]>(() => getKeynoteSessions(event.id));
  const days = useMemo(() => (event.startDate && event.endDate ? getDatesInRange(event.startDate, event.endDate) : []), [event.startDate, event.endDate]);

  // The event's own daily hours become the schedule's, unless the schedule sets its own.
  const eventHours = useMemo(() => {
    const ok = (t?: string) => !!t && !Number.isNaN(toMinutes(t));
    return ok(event.dailyStartTime) && ok(event.dailyEndTime) ? { start: event.dailyStartTime, end: event.dailyEndTime } : undefined;
  }, [event.dailyStartTime, event.dailyEndTime]);

  const ctx: ScheduleContext = useMemo(
    () => ({ keynotes: keynoteBlocks(keynoteSessions, stakeholders), eventDates: days.length > 0 ? days : undefined, eventHours }),
    [keynoteSessions, stakeholders, days, eventHours]
  );

  const [tab, setTab] = useState<Tab>(data.rooms.length === 0 ? 'rooms' : 'agenda');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<ScheduleSession | null>(null);

  // A keynote prints its room's name in the run of show. If the room is renamed here, keep that in step.
  useEffect(() => {
    let changed = false;
    for (const k of keynoteSessions) {
      const name = k.spaceId ? getSpace(data, k.spaceId)?.name : undefined;
      if (name && name !== k.stageOrRoom) {
        updateKeynoteSession(event.id, k.id, { stageOrRoom: name });
        changed = true;
      }
    }
    if (changed) setKeynoteSessions(getKeynoteSessions(event.id));
  }, [data.rooms, data.combinations, keynoteSessions, event.id]);

  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(t);
  }, [removed]);

  const warn = (warnings: Warning[]) => {
    if (warnings.length > 0) toast.warning(warnings.map((w) => w.message).join(' '));
  };

  const addSession = (input: SessionInput): string | null => {
    const made = createSession(input);
    if (made.ok === false) {
      toast.error(made.error, 'Not added');
      return null;
    }
    commit((prev) => ({ ...prev, sessions: [...prev.sessions, made.data] }));
    toast.success(`Added ${made.data.title}.`);
    return made.data.id;
  };

  const place = (sessionId: string, target: PlacementTarget): boolean => {
    const result = placeSession(data, ctx, sessionId, target);
    if (result.ok === false) {
      toast.error(result.error, 'Cannot place here');
      return false;
    }
    commit(result.data.data);
    warn(result.data.warnings);
    return true;
  };

  const nudge = (sessionId: string, delta: number) => {
    const result = nudgeSession(data, ctx, sessionId, delta);
    if (result.ok === false) {
      toast.error(result.error, 'Cannot move');
      return;
    }
    commit(result.data.data);
    warn(result.data.warnings);
  };

  const resize = (sessionId: string, minutes: number) => {
    const result = resizeSession(data, ctx, sessionId, minutes);
    if (result.ok === false) {
      toast.error(result.error, 'Cannot change length');
      return;
    }
    commit(result.data.data);
    warn(result.data.warnings);
  };

  const assign = (sessionId: string, spaceId: string | undefined) => {
    const result = assignSpace(data, ctx, sessionId, spaceId);
    if (result.ok === false) {
      toast.error(result.error, 'Cannot change room');
      return;
    }
    commit(result.data.data);
    warn(result.data.warnings);
  };

  const remove = (session: ScheduleSession) => {
    commit((prev) => removeSession(prev, session.id));
    setRemoved(session);
    setSelectedId(null);
  };

  const moveKeynote = (keynoteId: string, date: string, startTime: string): boolean => {
    const k = keynoteSessions.find((x) => x.id === keynoteId);
    if (!k) return false;
    const length = toMinutes(k.endTime) - toMinutes(k.startTime);
    updateKeynoteSession(event.id, keynoteId, { date, startTime, endTime: fromMinutes(toMinutes(startTime) + length) });
    setKeynoteSessions(getKeynoteSessions(event.id));
    toast.success(`Moved ${k.title} to ${startTime}.`);
    return true;
  };

  const keynoteSpaceIds = keynoteSessions.map((k) => k.spaceId).filter((id): id is string => !!id);

  const editor = (session: ScheduleSession) => (
    <SessionEditor
      session={session}
      data={data}
      ctx={ctx}
      stakeholders={stakeholders}
      days={days}
      onPatch={(patch) => commit((prev) => updateSession(prev, session.id, patch))}
      onResize={(m) => resize(session.id, m)}
      onAssignSpace={(spaceId) => assign(session.id, spaceId)}
      onPlace={(target) => place(session.id, target)}
      onUnplace={() => commit((prev) => unplaceSession(prev, session.id))}
      onRemove={() => remove(session)}
      onManageStakeholders={onManageStakeholders}
    />
  );

  const selected = data.sessions.find((s) => s.id === selectedId) ?? null;
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'agenda', label: 'Agenda', count: data.sessions.filter((s) => s.date && s.startTime).length },
    { id: 'sessions', label: 'Sessions', count: data.sessions.length },
    { id: 'rooms', label: 'Rooms & layouts', count: data.rooms.length },
    { id: 'day', label: 'Day structure', count: Object.values(data.dayBlocks).reduce((n, b) => n + b.length, 0) },
  ];

  return (
    <div className="mx-auto w-full max-w-[1760px] px-4 py-6 sm:px-6 lg:px-8">
      <section ref={modalRef} tabIndex={-1} aria-labelledby="schedule-modal-title" className="flex flex-col rounded border border-[#d8dce0] bg-white shadow-xs focus:outline-hidden">
        <div className="p-4 sm:p-5 border-b border-[#d8dce0] bg-[#f8f9fa]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <button type="button" onClick={onBack} className="focus-ring p-2 rounded text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#b9dcf0] bg-white transition-colors cursor-pointer" title="Back to menu" aria-label="Back to menu">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-xs text-[#46535e]">{event.title}</p>
                <h1 id="schedule-modal-title" className="text-lg font-bold text-[#252a2e] mt-0.5 flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-[#0063a3]" aria-hidden="true" />
                  <span>Schedule</span>
                </h1>
                <SaveStatus state={saveState} className="mt-1" />
              </div>
            </div>
          </div>

          <div role="tablist" aria-label="Schedule" className="mt-4 flex flex-wrap gap-1">
            {tabs.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') setTab(tabs[(i + 1) % tabs.length].id);
                  if (e.key === 'ArrowLeft') setTab(tabs[(i + tabs.length - 1) % tabs.length].id);
                }}
                className={`focus-ring cursor-pointer rounded px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === t.id ? 'bg-[#0063a3] text-white' : 'bg-white text-[#46535e] border border-[#d8dce0] hover:border-[#0063a3] hover:text-[#0063a3]'
                }`}
              >
                {t.label} <span className="font-mono tabular-nums opacity-80">{t.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f8f9fa] p-4 sm:p-5">
          {tab === 'agenda' && (
            <div role="tabpanel" aria-label="Agenda">
              <AgendaPanel
                data={data}
                ctx={ctx}
                days={days}
                stakeholders={stakeholders}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onPlace={place}
                onNudge={nudge}
                onMoveKeynote={moveKeynote}
                onAddSession={addSession}
                onSetDayLayout={(date, spaceId, layoutId) => {
                  const r = setDayLayout(data, date, spaceId, layoutId);
                  if (r.ok === false) toast.error(r.error, 'Not changed');
                  else commit(r.data);
                }}
                onGoToRooms={() => setTab('rooms')}
              >
                {selected && (
                  <section aria-label={`Editing ${selected.title}`} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-[#252a2e]">Editing: {selected.title}</h2>
                      <button type="button" onClick={() => setSelectedId(null)} className="focus-ring cursor-pointer rounded px-2 py-0.5 text-xs font-semibold text-[#46535e] hover:text-[#0063a3]">
                        Close editor
                      </button>
                    </div>
                    {editor(selected)}
                  </section>
                )}
              </AgendaPanel>
            </div>
          )}

          {tab === 'sessions' && (
            <div role="tabpanel" aria-label="Sessions">
              <SessionsPanel data={data} stakeholders={stakeholders} selectedId={selectedId} onSelect={setSelectedId} onAdd={addSession} onManageStakeholders={onManageStakeholders} renderEditor={editor} />
            </div>
          )}

          {tab === 'day' && (
            <div role="tabpanel" aria-label="Day structure">
              <DayStructurePanel data={data} ctx={ctx} days={days} onChange={commit} />
            </div>
          )}

          {tab === 'rooms' && (
            <div role="tabpanel" aria-label="Rooms and layouts">
              <RoomsPanel data={data} onChange={commit} keynoteSpaceIds={keynoteSpaceIds} />
            </div>
          )}

          {removed && (
            <div role="status" className="mt-4 flex items-center justify-between gap-3 rounded border border-[#d8dce0] bg-white px-3 py-2 text-xs text-[#252a2e] animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
              <span className="min-w-0 truncate">
                Removed <span className="font-semibold">&ldquo;{removed.title}&rdquo;</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  commit((prev) => ({ ...prev, sessions: [...prev.sessions, removed] }));
                  setRemoved(null);
                }}
                className="focus-ring shrink-0 cursor-pointer rounded px-2 py-0.5 font-semibold text-[#0063a3] hover:bg-[#e5f2f8]"
              >
                Undo
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
