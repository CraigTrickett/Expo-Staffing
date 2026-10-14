import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Reorder, motion, useDragControls, useReducedMotion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GripVertical,
  ListPlus,
  Plus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type { KeyStakeholder, KeynoteSession, RunOfShowSegment } from '@/types';
import {
  describeTimingStatus,
  moveSegment,
  resolveSegmentTeams,
  scheduleSegments,
  sessionWindowMinutes,
  timingStatus,
  totalSegmentMinutes,
} from '@/lib/keynote';
import { addStakeholder, TEAMS_OPTIONS } from '@/lib/stakeholders';
import { getTeamTone, UNASSIGNED_TONE } from '@/lib/teamTone';
import { toast } from '@/components/common/Toast';
import { InlineNumber, InlineText, inlineFieldClass } from './InlineField';
import { TeamChip } from './TeamChip';

const COLUMNS =
  'grid-cols-[56px_104px_76px_minmax(160px,1.2fr)_minmax(180px,1.4fr)_minmax(140px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)_68px]';

const SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.7 } as const;
const INSTANT = { duration: 0 } as const;

const dash = (time: string) => time.replace(' - ', '\u2013');

interface RunOfShowEditorProps {
  session: KeynoteSession;
  stakeholders: KeyStakeholder[];
  onChange: (segments: RunOfShowSegment[]) => void;
  onAddStakeholder?: (stakeholder: KeyStakeholder) => void;
}

type FocusTarget = 'handle' | 'up' | 'down';

export const RunOfShowEditor: React.FC<RunOfShowEditorProps> = ({
  session,
  stakeholders,
  onChange,
  onAddStakeholder,
}) => {
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState<RunOfShowSegment[]>(session.segments);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const [isAdding, setIsAdding] = useState(false);
  const [isAddingStakeholder, setIsAddingStakeholder] = useState(false);
  const [targetSegmentForNewStakeholder, setTargetSegmentForNewStakeholder] = useState<string | null>(null);

  const [hoverId, setHoverId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [removed, setRemoved] = useState<{ seg: RunOfShowSegment; index: number } | null>(null);

  const rowRefs = useRef(new Map<string, HTMLElement>());
  const controlRefs = useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = useRef<{ id: string; target: FocusTarget } | null>(null);

  // The parent owns persistence and re-derives start times; follow whatever it hands back.
  useEffect(() => {
    setItems(session.segments);
  }, [session.segments]);

  const scheduled = useMemo(() => scheduleSegments(session.startTime, items), [session.startTime, items]);
  const windowMinutes = sessionWindowMinutes(session.startTime, session.endTime);
  const total = totalSegmentMinutes(items);
  const status = timingStatus(total, windowMinutes);
  const teamsById = useMemo(
    () => new Map(items.map((s) => [s.id, resolveSegmentTeams(s, stakeholders)] as const)),
    [items, stakeholders]
  );

  const announce = (message: string) => setAnnouncement(message);

  const persist = useCallback(
    (next: RunOfShowSegment[]) => {
      setItems(next);
      onChange(next);
    },
    [onChange]
  );

  const updateSeg = (id: string, patch: Partial<RunOfShowSegment>) =>
    persist(itemsRef.current.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const liveDuration = (id: string, minutes: number) =>
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, durationMinutes: minutes } : s)));

  // Pointer drag: rows reorder locally while moving, and persist once on release.
  const commitDragOrder = () => {
    const current = itemsRef.current;
    const saved = session.segments;
    const unchanged = current.length === saved.length && current.every((s, i) => s.id === saved[i].id);
    if (unchanged) return;
    onChange(current);
    announce(`Order updated. ${current.length} segments.`);
  };

  const moveBy = (id: string, delta: -1 | 1, target: FocusTarget) => {
    const list = itemsRef.current;
    const from = list.findIndex((s) => s.id === id);
    const next = moveSegment(list, from, from + delta);
    if (next === list) return;
    pendingFocus.current = { id, target };
    persist(next);
    announce(`Moved \u201c${list[from].topic}\u201d to position ${from + delta + 1} of ${list.length}.`);
  };

  // A moved row can lose focus when the DOM reorders; put it back where the person was.
  useEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const wanted = controlRefs.current.get(`${pending.id}:${pending.target}`);
    const el = wanted && !wanted.disabled ? wanted : controlRefs.current.get(`${pending.id}:handle`);
    el?.focus();
  }, [items]);

  const removeSeg = (id: string) => {
    const list = itemsRef.current;
    const index = list.findIndex((s) => s.id === id);
    if (index < 0) return;
    const seg = list[index];
    persist(list.filter((s) => s.id !== id));
    setRemoved({ seg, index });
    announce(`Removed \u201c${seg.topic}\u201d. Undo is available.`);
  };

  const undoRemove = () => {
    if (!removed) return;
    const next = [...itemsRef.current];
    next.splice(Math.min(removed.index, next.length), 0, removed.seg);
    persist(next);
    setFlashId(removed.seg.id);
    announce(`Restored \u201c${removed.seg.topic}\u201d.`);
    setRemoved(null);
  };

  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(t);
  }, [removed]);

  const addSeg = (seg: RunOfShowSegment) => {
    persist([...itemsRef.current, seg]);
    setIsAdding(false);
    setFlashId(seg.id);
    announce(`Added \u201c${seg.topic}\u201d as segment ${itemsRef.current.length + 1}.`);
    toast.success('Added segment to run of show.', 'Segment Added');
  };

  const handleCreatedStakeholder = (newStk: KeyStakeholder) => {
    if (onAddStakeholder) {
      onAddStakeholder(newStk);
    }
    if (targetSegmentForNewStakeholder) {
      updateSeg(targetSegmentForNewStakeholder, {
        speakerIds: [newStk.id],
        speakerNames: `${newStk.firstName} ${newStk.lastName}`.trim(),
      });
      setTargetSegmentForNewStakeholder(null);
    }
    setIsAddingStakeholder(false);
    toast.success(`Added ${newStk.firstName} ${newStk.lastName} to Key Stakeholders.`, 'Stakeholder Created');
  };

  useEffect(() => {
    if (!flashId) return;
    rowRefs.current.get(flashId)?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    const t = window.setTimeout(() => setFlashId(null), 1500);
    return () => window.clearTimeout(t);
  }, [flashId, reduceMotion]);

  const jumpToRow = (id: string) => {
    const row = rowRefs.current.get(id);
    if (!row) return;
    row.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    row.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true });
  };

  return (
    <div className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#252a2e]">
            Run of Show Sequence &amp; Timing Blocks
          </h4>
          <p className="mt-0.5 text-[11px] text-[#5b6770]">
            Click any cell to edit. Drag the grip to reorder. Columns align with the structured Markdown &amp; Google Docs exports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTargetSegmentForNewStakeholder(null);
              setIsAddingStakeholder(true);
            }}
            className="focus-ring flex cursor-pointer items-center gap-1 rounded border border-[#b9dcf0] bg-[#e5f2f8] px-2.5 py-1.5 text-xs font-semibold text-[#0063a3] transition-colors hover:bg-[#d0e8f5]"
            title="Add a new stakeholder to the event directory"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Stakeholder</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#005084]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Segment</span>
          </button>
        </div>
      </div>

      {isAdding && (
        <AddSegmentForm
          stakeholders={stakeholders}
          count={items.length}
          sessionSlideDeckUrl={session.slideDeckUrl}
          onAdd={addSeg}
          onCancel={() => setIsAdding(false)}
          onOpenAddStakeholder={() => setIsAddingStakeholder(true)}
        />
      )}

      {isAddingStakeholder && (
        <QuickAddStakeholderModal
          eventId={session.eventId}
          onSave={handleCreatedStakeholder}
          onCancel={() => {
            setIsAddingStakeholder(false);
            setTargetSegmentForNewStakeholder(null);
          }}
        />
      )}

      <TimelineStrip
        segments={scheduled}
        teamsById={teamsById}
        startTime={session.startTime}
        endTime={session.endTime}
        windowMinutes={windowMinutes}
        total={total}
        status={status}
        hoverId={hoverId}
        onHover={setHoverId}
        onSelect={jumpToRow}
        reduceMotion={!!reduceMotion}
      />

      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>

      <div role="table" aria-label="Run of show segments" className="overflow-x-auto rounded border border-[#d8dce0]">
        <div className="min-w-[1050px]">
          <div
            role="row"
            className={`grid ${COLUMNS} items-center border-b border-[#d8dce0] bg-[#f8f9fa] px-1 py-2 text-[11px] font-semibold text-[#5b6770]`}
          >
            <div role="columnheader" className="px-2 text-center">
              Order
            </div>
            <div role="columnheader" className="px-2">
              Time
            </div>
            <div role="columnheader" className="px-2">
              Duration
            </div>
            <div role="columnheader" className="px-2">
              Speaker(s)
            </div>
            <div role="columnheader" className="px-2">
              Topic / Segment
            </div>
            <div role="columnheader" className="px-2">
              Slide / Deck Link
            </div>
            <div role="columnheader" className="px-2">
              Handover / Transition
            </div>
            <div role="columnheader" className="px-2">
              Stage Cues &amp; AV
            </div>
            <div role="columnheader" className="px-2 text-right">
              <span className="sr-only">Actions</span>
            </div>
          </div>

          <Reorder.Group
            as="div"
            axis="y"
            role="rowgroup"
            values={items}
            onReorder={setItems}
            className="divide-y divide-[#e7eaef]"
          >
            {items.map((seg, index) => (
              <SegmentRow
                key={seg.id}
                seg={seg}
                index={index}
                count={items.length}
                time={scheduled[index]?.time ?? ''}
                teams={teamsById.get(seg.id) ?? []}
                stakeholders={stakeholders}
                sessionSlideDeckUrl={session.slideDeckUrl}
                isHovered={hoverId === seg.id}
                isFlashing={flashId === seg.id}
                reduceMotion={!!reduceMotion}
                onHover={setHoverId}
                onDragEnd={commitDragOrder}
                onUpdate={updateSeg}
                onLiveDuration={liveDuration}
                onMove={moveBy}
                onRemove={removeSeg}
                onQuickAddStakeholder={() => {
                  setTargetSegmentForNewStakeholder(seg.id);
                  setIsAddingStakeholder(true);
                }}
                registerRow={(el) => {
                  if (el) rowRefs.current.set(seg.id, el);
                  else rowRefs.current.delete(seg.id);
                }}
                registerControl={(key, el) => {
                  const k = `${seg.id}:${key}`;
                  if (el) controlRefs.current.set(k, el);
                  else controlRefs.current.delete(k);
                }}
              />
            ))}
          </Reorder.Group>

          {items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <ListPlus className="h-5 w-5 text-[#5b6770]" aria-hidden="true" />
              <p className="text-xs font-semibold text-[#252a2e]">No segments yet</p>
              <p className="max-w-xs text-[11px] text-[#5b6770]">
                Add the first block of the show. Start times fill in from the session start as you build the order.
              </p>
            </div>
          )}
        </div>
      </div>

      {removed && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded border border-[#d8dce0] bg-[#f8f9fa] px-3 py-2 text-xs text-[#252a2e] animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
        >
          <span className="min-w-0 truncate">
            Removed <span className="font-semibold">&ldquo;{removed.seg.topic}&rdquo;</span>
          </span>
          <button
            type="button"
            onClick={undoRemove}
            className="focus-ring shrink-0 cursor-pointer rounded px-2 py-0.5 font-semibold text-[#0063a3] hover:bg-[#e5f2f8]"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Segment row                                                         */
/* ------------------------------------------------------------------ */

interface SegmentRowProps {
  seg: RunOfShowSegment;
  index: number;
  count: number;
  time: string;
  teams: string[];
  stakeholders: KeyStakeholder[];
  sessionSlideDeckUrl?: string;
  isHovered: boolean;
  isFlashing: boolean;
  reduceMotion: boolean;
  onHover: (id: string | null) => void;
  onDragEnd: () => void;
  onUpdate: (id: string, patch: Partial<RunOfShowSegment>) => void;
  onLiveDuration: (id: string, minutes: number) => void;
  onMove: (id: string, delta: -1 | 1, target: FocusTarget) => void;
  onRemove: (id: string) => void;
  onQuickAddStakeholder: () => void;
  registerRow: (el: HTMLElement | null) => void;
  registerControl: (key: FocusTarget, el: HTMLButtonElement | null) => void;
}

const SegmentRow: React.FC<SegmentRowProps> = ({
  seg,
  index,
  count,
  time,
  teams,
  stakeholders,
  sessionSlideDeckUrl,
  isHovered,
  isFlashing,
  reduceMotion,
  onHover,
  onDragEnd,
  onUpdate,
  onLiveDuration,
  onMove,
  onRemove,
  onQuickAddStakeholder,
  registerRow,
  registerControl,
}) => {
  const controls = useDragControls();
  const linkedId = seg.speakerIds[0] ?? '';
  const linkedKnown = !linkedId || stakeholders.some((s) => s.id === linkedId);

  const chooseSpeaker = (id: string) => {
    if (id === '__new__') {
      onQuickAddStakeholder();
      return;
    }
    if (!id) {
      onUpdate(seg.id, { speakerIds: [], speakerNames: seg.speakerNames });
      return;
    }
    const match = stakeholders.find((s) => s.id === id);
    onUpdate(seg.id, {
      speakerIds: [id],
      speakerNames: match ? `${match.firstName} ${match.lastName}`.trim() : seg.speakerNames,
    });
  };

  const effectiveSlideUrl = seg.slideDeckLink || sessionSlideDeckUrl;

  return (
    <Reorder.Item
      as="div"
      ref={registerRow}
      value={seg}
      role="row"
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      onMouseEnter={() => onHover(seg.id)}
      onMouseLeave={() => onHover(null)}
      transition={reduceMotion ? INSTANT : SPRING}
      whileDrag={
        reduceMotion
          ? undefined
          : { scale: 1.004, boxShadow: '0 10px 15px -3px rgba(37,42,46,0.18), 0 4px 6px -2px rgba(37,42,46,0.1)' }
      }
      className={`relative grid ${COLUMNS} items-start bg-white px-1 py-1.5 transition-colors duration-150 ${
        isHovered ? 'bg-[#f0f7fb]!' : ''
      } ${isFlashing ? 'animate-[row-flash_1.4s_ease-out] motion-reduce:animate-none' : ''}`}
    >
      {/* 1. Order */}
      <div role="cell" className="flex items-center justify-center gap-0.5 pt-1">
        <button
          type="button"
          ref={(el) => registerControl('handle', el)}
          aria-label={`Reorder segment ${index + 1}: ${seg.topic}. Drag, or hold Alt and press Arrow Up or Down.`}
          title="Drag to reorder"
          onPointerDown={(e) => {
            e.preventDefault();
            controls.start(e);
          }}
          onKeyDown={(e) => {
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              e.preventDefault();
              onMove(seg.id, e.key === 'ArrowUp' ? -1 : 1, 'handle');
            }
          }}
          className="focus-ring touch-none cursor-grab rounded p-1 text-[#5b6770] transition-colors hover:bg-[#e5f2f8] hover:text-[#0063a3] active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="w-4 text-center font-mono text-xs font-bold tabular-nums text-[#5b6770]">{index + 1}</span>
      </div>

      {/* 2. Time */}
      <div role="cell" className="px-2 pt-1.5">
        <div className="font-mono text-[11px] font-semibold tabular-nums text-[#252a2e]">{dash(time)}</div>
      </div>

      {/* 3. Duration */}
      <div role="cell" className="px-1 pt-1">
        <div className="flex items-center gap-1 text-[11px] text-[#5b6770]">
          <InlineNumber
            value={seg.durationMinutes}
            min={1}
            max={240}
            label={`Duration in minutes for segment ${index + 1}`}
            onLive={(n) => onLiveDuration(seg.id, n)}
            onCommit={(n) => onUpdate(seg.id, { durationMinutes: n })}
            className="w-11"
          />
          <span className="font-mono text-[10px]">min</span>
        </div>
      </div>

      {/* 4. Speaker(s) & Team */}
      <div role="cell" className="space-y-1 px-1">
        <div className="flex items-center gap-1">
          <select
            aria-label={`Speaker for segment ${index + 1}`}
            value={linkedId}
            onChange={(e) => chooseSpeaker(e.target.value)}
            className={`${inlineFieldClass} cursor-pointer text-xs`}
          >
            <option value="">Guest or other</option>
            <option value="__new__">+ Quick Add Stakeholder...</option>
            {!linkedKnown && <option value={linkedId}>{seg.speakerNames || 'Removed stakeholder'}</option>}
            {stakeholders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.team})
              </option>
            ))}
          </select>
        </div>
        {!linkedId && (
          <InlineText
            value={seg.speakerNames}
            label={`Speaker name for segment ${index + 1}`}
            placeholder="Guest speaker name"
            onCommit={(next) => onUpdate(seg.id, { speakerNames: next })}
            className="text-xs"
          />
        )}
        <div className="flex flex-wrap gap-1">
          {teams.length > 0 ? (
            teams.map((team) => <TeamChip key={team} team={team} />)
          ) : (
            <span className="text-[10px] text-[#7c878e]">&mdash;</span>
          )}
        </div>
      </div>

      {/* 5. Topic / Segment */}
      <div role="cell" className="px-1">
        <InlineText
          value={seg.topic}
          label={`Topic for segment ${index + 1}`}
          required
          requiredMessage="A segment needs a topic."
          semibold
          onCommit={(next) => onUpdate(seg.id, { topic: next })}
          className="text-xs"
        />
      </div>

      {/* 6. Slide / Deck Link */}
      <div role="cell" className="px-1 space-y-1">
        <div className="flex items-center gap-1">
          <InlineText
            value={seg.slideDeckLink ?? ''}
            label={`Slide link for segment ${index + 1}`}
            placeholder="Add slide URL"
            onCommit={(next) => onUpdate(seg.id, { slideDeckLink: next })}
            className="text-[11px] font-mono"
          />
          {effectiveSlideUrl && (
            <a
              href={effectiveSlideUrl}
              target="_blank"
              rel="noreferrer"
              className="p-1 text-[#0063a3] hover:text-[#005084] hover:bg-[#e5f2f8] rounded shrink-0 transition-colors"
              title={seg.slideDeckLink ? 'Test slide link' : 'Open session master deck'}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* 7. Handover / Transition */}
      <div role="cell" className="px-1">
        <InlineText
          value={seg.handoverNotes ?? ''}
          label={`Handover note for segment ${index + 1}`}
          placeholder="Add transition / stinger"
          onCommit={(next) => onUpdate(seg.id, { handoverNotes: next })}
          className="text-[11px]"
        />
      </div>

      {/* 8. Stage Cues & AV */}
      <div role="cell" className="px-1">
        <InlineText
          value={seg.cueNotes ?? ''}
          label={`Stage cues for segment ${index + 1}`}
          placeholder="Add stage cues / mic"
          onCommit={(next) => onUpdate(seg.id, { cueNotes: next })}
          className="text-[11px]"
        />
      </div>

      {/* 9. Actions */}
      <div role="cell" className="flex items-center justify-end gap-0.5 pt-1 pr-1">
        <div className="flex flex-col">
          <button
            type="button"
            ref={(el) => registerControl('up', el)}
            disabled={index === 0}
            onClick={() => onMove(seg.id, -1, 'up')}
            aria-label={`Move segment ${index + 1} earlier`}
            title="Move earlier"
            className="focus-ring cursor-pointer rounded p-0.5 text-[#5b6770] hover:text-[#0063a3] disabled:cursor-default disabled:opacity-25"
          >
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
          </button>
          <button
            type="button"
            ref={(el) => registerControl('down', el)}
            disabled={index === count - 1}
            onClick={() => onMove(seg.id, 1, 'down')}
            aria-label={`Move segment ${index + 1} later`}
            title="Move later"
            className="focus-ring cursor-pointer rounded p-0.5 text-[#5b6770] hover:text-[#0063a3] disabled:cursor-default disabled:opacity-25"
          >
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => onRemove(seg.id)}
          aria-label={`Remove segment ${index + 1}: ${seg.topic}`}
          title="Remove segment"
          className="focus-ring cursor-pointer rounded p-1 text-[#da3832] transition-colors hover:bg-[#fdecec]"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </Reorder.Item>
  );
};

/* ------------------------------------------------------------------ */
/* Timeline strip                                                      */
/* ------------------------------------------------------------------ */

interface TimelineStripProps {
  segments: RunOfShowSegment[];
  teamsById: Map<string, string[]>;
  startTime: string;
  endTime: string;
  windowMinutes: number;
  total: number;
  status: ReturnType<typeof timingStatus>;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  reduceMotion: boolean;
}

const TimelineStrip: React.FC<TimelineStripProps> = ({
  segments,
  teamsById,
  startTime,
  endTime,
  windowMinutes,
  total,
  status,
  hoverId,
  onHover,
  onSelect,
  reduceMotion,
}) => {
  const scale = Math.max(total, windowMinutes) || 1;
  const windowPct = (windowMinutes / scale) * 100;
  const spare = status.kind === 'spare' ? status.minutes : 0;

  const statusText = describeTimingStatus(status);
  const statusColour =
    status.kind === 'over' ? 'text-[#9e1b16]' : status.kind === 'exact' ? 'text-[#005a28]' : 'text-[#46535e]';

  return (
    <div className="rounded border border-[#d8dce0] bg-[#f8f9fa] px-3 pb-2 pt-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[11px]">
        <p className="text-[#5b6770]">
          Session window{' '}
          <span className="font-mono font-semibold tabular-nums text-[#252a2e]">
            {startTime}&ndash;{endTime}
          </span>{' '}
          &middot; {windowMinutes} min
        </p>
        <p className={`font-semibold ${statusColour}`} role="status">
          <span className="font-mono tabular-nums">{total}</span> min planned &middot; {statusText}
        </p>
      </div>

      <div className="relative mt-2 h-11" role="group" aria-label="Run of show timeline">
        <div className="absolute inset-0 flex">
          {segments.map((seg, i) => {
            const pct = ((seg.durationMinutes || 5) / scale) * 100;
            const teams = teamsById.get(seg.id) ?? [];
            const tone = teams.length > 0 ? getTeamTone(teams[0]) : UNASSIGNED_TONE;
            const label = `Segment ${i + 1}: ${seg.topic}, ${seg.durationMinutes} min, ${dash(seg.time)}${
              teams.length ? `, ${teams.join(' and ')}` : ''
            }`;
            const active = hoverId === seg.id;
            return (
              <motion.div
                key={seg.id}
                layout="position"
                transition={reduceMotion ? INSTANT : SPRING}
                className="h-full shrink-0 pr-0.5"
                style={{ width: `${pct}%` }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(seg.id)}
                  onMouseEnter={() => onHover(seg.id)}
                  onMouseLeave={() => onHover(null)}
                  onFocus={() => onHover(seg.id)}
                  onBlur={() => onHover(null)}
                  aria-label={label}
                  title={label}
                  className="focus-ring relative flex h-full w-full cursor-pointer flex-col justify-between overflow-hidden rounded-[3px] border px-1.5 pb-0 pt-1 text-left transition-shadow duration-150"
                  style={{
                    background: tone.bg,
                    color: tone.fg,
                    borderColor: active ? tone.accent : tone.border,
                    boxShadow: active ? `0 0 0 1px ${tone.accent}` : undefined,
                  }}
                >
                  <span className="flex min-w-0 items-baseline gap-1 text-[11px] font-semibold leading-none">
                    <span className="font-mono tabular-nums">{i + 1}</span>
                    {pct >= 13 && <span className="truncate font-medium">{seg.topic}</span>}
                  </span>
                  <span className="-mx-1.5 block h-1" style={{ background: tone.accent }} aria-hidden="true" />
                </button>
              </motion.div>
            );
          })}
          {spare > 0 && (
            <div
              className="h-full flex-1 rounded-[3px] border border-dashed border-[#c5ccd3]"
              aria-hidden="true"
            />
          )}
        </div>

        {status.kind === 'over' && (
          <div
            className="pointer-events-none absolute inset-y-0 right-0 rounded-r-[3px]"
            style={{
              left: `${windowPct}%`,
              background:
                'repeating-linear-gradient(135deg, rgba(218,56,50,0) 0 5px, rgba(218,56,50,0.32) 5px 7px)',
            }}
            aria-hidden="true"
          />
        )}
        <div
          className="pointer-events-none absolute -bottom-1 -top-1 w-0.5 bg-[#252a2e]"
          style={{ left: `calc(${windowPct}% - 1px)` }}
          aria-hidden="true"
        />
      </div>

      <div className="relative mt-1.5 h-3.5 font-mono text-[10px] tabular-nums text-[#5b6770]" aria-hidden="true">
        <span className="absolute left-0">{startTime}</span>
        <span className="absolute -translate-x-full pr-1" style={{ left: `${windowPct}%` }}>
          {endTime}
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Add form                                                            */
/* ------------------------------------------------------------------ */

const fieldClass =
  'w-full rounded border border-[#d8dce0] bg-white px-3 py-1.5 text-xs text-[#252a2e] focus:border-[#0063a3] focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,99,163,0.18)]';

const AddSegmentForm: React.FC<{
  stakeholders: KeyStakeholder[];
  count: number;
  sessionSlideDeckUrl?: string;
  onAdd: (seg: RunOfShowSegment) => void;
  onCancel: () => void;
  onOpenAddStakeholder: () => void;
}> = ({ stakeholders, count, sessionSlideDeckUrl, onAdd, onCancel, onOpenAddStakeholder }) => {
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState(15);
  const [speakerId, setSpeakerId] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [slideLink, setSlideLink] = useState('');
  const [handover, setHandover] = useState('');
  const [cue, setCue] = useState('');
  const topicRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    topicRef.current?.focus();
  }, []);

  const handleSpeakerChange = (val: string) => {
    if (val === '__new__') {
      onOpenAddStakeholder();
      return;
    }
    setSpeakerId(val);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error('Topic is required.', 'Missing Field');
      return;
    }
    const match = stakeholders.find((s) => s.id === speakerId);
    onAdd({
      id: `seg_${Date.now()}`,
      order: count + 1,
      time: '',
      durationMinutes: Math.min(240, Math.max(1, Number(duration) || 10)),
      topic: topic.trim(),
      speakerIds: match ? [match.id] : [],
      speakerNames: match ? `${match.firstName} ${match.lastName}`.trim() : speakerName.trim() || 'TBD',
      handoverNotes: handover.trim(),
      cueNotes: cue.trim(),
      slideDeckLink: slideLink.trim() || sessionSlideDeckUrl || '',
    });
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
      className="space-y-3 rounded border border-[#d8dce0] bg-[#f8f9fa] p-4 animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#0063a3]">Add New Run of Show Segment</span>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring cursor-pointer rounded px-1 text-xs text-[#5b6770] hover:text-[#252a2e]"
        >
          Cancel
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label htmlFor="seg-topic" className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Segment Topic / Action *
          </label>
          <input
            id="seg-topic"
            ref={topicRef}
            type="text"
            required
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Live Architecture & Platform Demo"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="seg-duration" className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Duration (Minutes) *
          </label>
          <input
            id="seg-duration"
            type="number"
            min={1}
            max={240}
            required
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value, 10) || 5)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="seg-speaker" className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Assign Speaker (Stakeholder)
          </label>
          <select
            id="seg-speaker"
            value={speakerId}
            onChange={(e) => handleSpeakerChange(e.target.value)}
            className={fieldClass}
          >
            <option value="">Select or type below</option>
            <option value="__new__">+ Quick Add Stakeholder...</option>
            {stakeholders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.team})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="seg-name" className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Speaker Name (if not in stakeholder list)
          </label>
          <input
            id="seg-name"
            type="text"
            value={speakerName}
            disabled={!!speakerId}
            onChange={(e) => setSpeakerName(e.target.value)}
            placeholder="e.g. Guest Customer Speaker"
            className={`${fieldClass} disabled:bg-[#f1f3f6] disabled:text-[#5b6770]`}
          />
        </div>
        <div>
          <label htmlFor="seg-slide" className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Slide / Presentation Deck Link
          </label>
          <input
            id="seg-slide"
            type="url"
            value={slideLink}
            onChange={(e) => setSlideLink(e.target.value)}
            placeholder="https://docs.google.com/presentation/d/...#slide=id.p4"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="seg-handover" className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Handover &amp; Transition Note
          </label>
          <input
            id="seg-handover"
            type="text"
            value={handover}
            onChange={(e) => setHandover(e.target.value)}
            placeholder="e.g. Connecting motion graphic to intro demo"
            className={fieldClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="seg-cue" className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
          Stage Cues &amp; AV Instructions
        </label>
        <input
          id="seg-cue"
          type="text"
          value={cue}
          onChange={(e) => setCue(e.target.value)}
          placeholder="e.g. Lapel mic 1, spotlight center, lower house lights"
          className={fieldClass}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring cursor-pointer rounded border border-[#d8dce0] bg-white px-3 py-1 text-xs text-[#46535e] hover:border-[#0063a3]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]"
        >
          Add Segment
        </button>
      </div>
    </form>
  );
};

/* ------------------------------------------------------------------ */
/* Quick Add Stakeholder Modal                                         */
/* ------------------------------------------------------------------ */

interface QuickAddStakeholderModalProps {
  eventId: string;
  onSave: (stakeholder: KeyStakeholder) => void;
  onCancel: () => void;
}

const QuickAddStakeholderModal: React.FC<QuickAddStakeholderModalProps> = ({
  eventId,
  onSave,
  onCancel,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('Executive Leadership');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error('First name, last name, and email are required.', 'Missing Fields');
      return;
    }
    const newStk = addStakeholder(eventId, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      team,
      involvedWith: ['Keynote / General Session'],
    });
    onSave(newStk);
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#d8dce0] rounded-lg p-5 max-w-md w-full shadow-modus-3 space-y-4"
      >
        <div className="flex items-center justify-between pb-2 border-b border-[#e5e9ec]">
          <div className="flex items-center gap-2 text-[#0063a3]">
            <UserPlus className="w-4 h-4" />
            <h4 className="text-sm font-bold">Quick Add Key Stakeholder</h4>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-[#5b6770] hover:text-[#252a2e] p-1 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#5b6770]">
          Add this speaker to the Key Stakeholders directory. They will immediately be available across all event sessions.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
              First Name *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Elena"
              className={fieldClass}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
              Surname *
            </label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Vance"
              className={fieldClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
            Email *
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="elena.vance@trimble.com"
            className={fieldClass}
          />
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
            Team / Department
          </label>
          <select
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            className={fieldClass}
          >
            {TEAMS_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5e9ec]">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-xs font-semibold text-[#46535e] bg-white border border-[#d8dce0] hover:bg-[#f1f3f6] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white shadow-xs cursor-pointer flex items-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add &amp; Assign Stakeholder</span>
          </button>
        </div>
      </form>
    </div>
  );
};
