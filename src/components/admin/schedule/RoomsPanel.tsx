import React, { useId, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, DoorOpen, Layers2, Plus, Trash2 } from 'lucide-react';
import type { ScheduleData } from '@/types/schedule';
import {
  addCombination, addLayout, addRoom, defaultSpaceName, listSpaces, moveRoom, removeCombination, removeLayout, removeRoom,
  renameCombination, renameLayout, renameRoom, setCapacity,
} from '@/lib/schedule';
import type { Result } from '@/lib/schedule';
import { InlineText } from '@/components/common/InlineField';
import { formFieldClass } from '@/components/common/StakeholderSelect';
import { toast } from '@/components/common/Toast';

interface RoomsPanelProps {
  data: ScheduleData;
  onChange: (next: ScheduleData) => void;
  /** Spaces that keynotes are in, so they cannot be removed from under them. */
  keynoteSpaceIds: string[];
}

const Section: React.FC<{ id: string; title: string; icon: React.ReactNode; hint?: string; children: React.ReactNode }> = ({ id, title, icon, hint, children }) => (
  <section aria-labelledby={id} className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
    <div>
      <h2 id={id} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#252a2e]">
        {icon}
        {title}
      </h2>
      {hint && <p className="mt-0.5 text-[11px] text-[#5b6770]">{hint}</p>}
    </div>
    {children}
  </section>
);

/** A capacity cell. Empty means the layout is not offered in that room; a number is how many it seats. */
const CapacityInput: React.FC<{ value: number | undefined; label: string; onCommit: (n: number | null) => boolean }> = ({ value, label, onCommit }) => {
  const [draft, setDraft] = useState(value ? String(value) : '');
  const focused = useRef(false);
  React.useEffect(() => {
    if (!focused.current) setDraft(value ? String(value) : '');
  }, [value]);
  const commit = () => {
    focused.current = false;
    const text = draft.trim();
    const next = text === '' ? null : Number(text);
    if (next === (value ?? null)) return;
    if (next !== null && (!Number.isInteger(next) || next < 1)) {
      toast.error('Capacity must be a whole number of at least 1.', 'Not saved');
      setDraft(value ? String(value) : '');
      return;
    }
    if (!onCommit(next)) setDraft(value ? String(value) : '');
  };
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      placeholder={'\u2013'}
      value={draft}
      onFocus={(e) => {
        focused.current = true;
        e.currentTarget.select();
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className="focus-ring w-16 rounded border border-[#d8dce0] bg-white px-2 py-1 text-right font-mono text-xs tabular-nums text-[#252a2e] placeholder:text-[#9aa5ad] focus:border-[#0063a3] focus:outline-none"
    />
  );
};

export const RoomsPanel: React.FC<RoomsPanelProps> = ({ data, onChange, keynoteSpaceIds }) => {
  const uid = useId();
  const [newLayout, setNewLayout] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [joinIds, setJoinIds] = useState<string[]>([]);
  const [joinName, setJoinName] = useState('');
  const spaces = listSpaces(data);

  /** Applies a logic result: commits on success, tells the person why on failure. Returns whether it worked. */
  const apply = (result: Result<ScheduleData>): boolean => {
    if (result.ok === false) {
      toast.error(result.error, 'Not changed');
      return false;
    }
    onChange(result.data);
    return true;
  };

  const roomName = (id: string) => data.rooms.find((r) => r.id === id)?.name ?? '';
  const previewName = defaultSpaceName(joinIds.map(roomName));

  return (
    <div className="space-y-4">
      <Section id={`${uid}-layouts`} title="Layouts" icon={<Layers2 className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />} >
        <ul className="flex flex-wrap gap-2">
          {data.layouts.map((l) => (
            <li key={l.id} className="flex items-center gap-1 rounded border border-[#d8dce0] bg-[#f8f9fa] pr-1">
              <div className="w-28">
                <InlineText value={l.name} label={`Name of layout ${l.name}`} required requiredMessage="A layout needs a name." onCommit={(v) => apply(renameLayout(data, l.id, v))} />
              </div>
              <button type="button" onClick={() => apply(removeLayout(data, l.id))} aria-label={`Remove layout ${l.name}`} title="Remove layout" className="focus-ring cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]">
                <Trash2 className="h-3 w-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <form
          aria-label="Add layout"
          onSubmit={(e) => {
            e.preventDefault();
            if (apply(addLayout(data, newLayout))) setNewLayout('');
          }}
          className="flex items-end gap-2"
        >
          <div className="w-48">
            <label htmlFor={`${uid}-nl`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">New layout</label>
            <input id={`${uid}-nl`} type="text" value={newLayout} onChange={(e) => setNewLayout(e.target.value)} placeholder="e.g. Banquet" className={formFieldClass} />
          </div>
          <button type="submit" className="focus-ring flex cursor-pointer items-center gap-1 rounded border border-[#0063a3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0063a3] hover:bg-[#e5f2f8]">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add layout
          </button>
        </form>
      </Section>

      <Section id={`${uid}-rooms`} title="Rooms" icon={<DoorOpen className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />} hint="Their order sets which rooms can be joined.">
        {data.rooms.length > 0 && (
          <ul className="divide-y divide-[#e7eaef] rounded border border-[#e7eaef]">
            {data.rooms.map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <div className="flex flex-col">
                  <button type="button" disabled={i === 0} onClick={() => apply(moveRoom(data, r.id, -1))} aria-label={`Move ${r.name} earlier`} className="focus-ring cursor-pointer rounded p-0.5 text-[#5b6770] hover:text-[#0063a3] disabled:cursor-default disabled:opacity-25">
                    <ArrowUp className="h-3 w-3" aria-hidden="true" />
                  </button>
                  <button type="button" disabled={i === data.rooms.length - 1} onClick={() => apply(moveRoom(data, r.id, 1))} aria-label={`Move ${r.name} later`} className="focus-ring cursor-pointer rounded p-0.5 text-[#5b6770] hover:text-[#0063a3] disabled:cursor-default disabled:opacity-25">
                    <ArrowDown className="h-3 w-3" aria-hidden="true" />
                  </button>
                </div>
                <div className="w-56">
                  <InlineText value={r.name} label={`Name of room ${r.name}`} required requiredMessage="A room needs a name." semibold onCommit={(v) => apply(renameRoom(data, r.id, v))} />
                </div>
                <div className="min-w-[200px] flex-1">
                  <InlineText value={r.notes ?? ''} label={`Notes for ${r.name}`} placeholder="Notes: AV, access, fire code" onCommit={(v) => onChange({ ...data, rooms: data.rooms.map((x) => (x.id === r.id ? { ...x, notes: v || undefined } : x)) })} className="text-[11px]" />
                </div>
                <button type="button" onClick={() => apply(removeRoom(data, r.id, keynoteSpaceIds))} aria-label={`Remove room ${r.name}`} title="Remove room" className="focus-ring cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          aria-label="Add room"
          onSubmit={(e) => {
            e.preventDefault();
            if (apply(addRoom(data, newRoom))) setNewRoom('');
          }}
          className="flex items-end gap-2"
        >
          <div className="w-64">
            <label htmlFor={`${uid}-nr`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">New room</label>
            <input id={`${uid}-nr`} type="text" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="e.g. Murano 3202" className={formFieldClass} />
          </div>
          <button type="submit" className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add room
          </button>
        </form>
      </Section>

      <Section id={`${uid}-joined`} title="Joined rooms" icon={<DoorOpen className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />} hint="Rooms the venue can join with an airwall. Booking one blocks each room in it.">
        {data.combinations.length > 0 && (
          <ul className="divide-y divide-[#e7eaef] rounded border border-[#e7eaef]">
            {data.combinations.map((c) => {
              const space = spaces.find((s) => s.id === c.id);
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <div className="w-64">
                    <InlineText
                      value={c.name ?? ''}
                      label={`Name of joined room ${space?.name}`}
                      placeholder={space?.name}
                      semibold
                      onCommit={(v) => {
                        onChange(renameCombination(data, c.id, v));
                        return true;
                      }}
                    />
                  </div>
                  <p className="min-w-[200px] flex-1 text-[11px] text-[#5b6770]">Joins {c.roomIds.map(roomName).join(' + ')}</p>
                  <button type="button" onClick={() => apply(removeCombination(data, c.id, keynoteSpaceIds))} aria-label={`Remove joined room ${space?.name}`} title="Remove joined room" className="focus-ring cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {data.rooms.length >= 2 ? (
          <form
            aria-label="Join rooms"
            onSubmit={(e) => {
              e.preventDefault();
              if (apply(addCombination(data, joinIds, joinName))) {
                setJoinIds([]);
                setJoinName('');
              }
            }}
            className="space-y-2 rounded border border-[#e7eaef] bg-[#f8f9fa] p-3"
          >
            <fieldset>
              <legend className="mb-1 text-[11px] font-semibold text-[#252a2e]">Rooms to join</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {data.rooms.map((r) => (
                  <label key={r.id} className="flex cursor-pointer items-center gap-1.5 text-xs text-[#252a2e]">
                    <input type="checkbox" checked={joinIds.includes(r.id)} onChange={(e) => setJoinIds((ids) => (e.target.checked ? [...ids, r.id] : ids.filter((x) => x !== r.id)))} className="accent-[#0063a3]" />
                    {r.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-wrap items-end gap-2">
              <div className="w-64">
                <label htmlFor={`${uid}-jn`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Name</label>
                <input id={`${uid}-jn`} type="text" value={joinName} onChange={(e) => setJoinName(e.target.value)} placeholder={previewName || 'Optional'} className={formFieldClass} />
              </div>
              <button type="submit" disabled={joinIds.length < 2} className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084] disabled:cursor-default disabled:opacity-50">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Join rooms
              </button>
              {joinIds.length >= 2 && <p className="pb-1.5 text-[11px] text-[#5b6770]">Will be called {joinName.trim() || previewName}.</p>}
            </div>
          </form>
        ) : (
          <p className="text-[11px] text-[#5b6770]">Add at least two rooms to join them.</p>
        )}
      </Section>

      {spaces.length > 0 && (
        <Section id={`${uid}-cap`} title="Capacity" icon={<Layers2 className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />} hint="Seats per layout. Leave a cell empty if the room does not offer it.">
          <div className="overflow-x-auto rounded border border-[#e7eaef]">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="sr-only">Capacity by room and layout</caption>
              <thead className="bg-[#f8f9fa] text-[11px] text-[#5b6770]">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Room</th>
                  {data.layouts.map((l) => (
                    <th key={l.id} scope="col" className="px-2 py-2 text-right font-semibold">{l.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7eaef]">
                {spaces.map((s) => (
                  <tr key={s.id} className={s.kind === 'combination' ? 'bg-[#f8f9fa]' : undefined}>
                    <th scope="row" className="px-3 py-1.5 font-semibold text-[#252a2e]">
                      {s.name}
                      {s.kind === 'combination' && <span className="ml-1.5 font-normal text-[#5b6770]">(joined)</span>}
                    </th>
                    {data.layouts.map((l) => (
                      <td key={l.id} className="px-2 py-1 text-right">
                        <CapacityInput
                          value={s.capacities[l.id]}
                          label={`${s.name}, ${l.name} capacity`}
                          onCommit={(n) => apply(setCapacity(data, s.id, l.id, n))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
};
