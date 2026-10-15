import React, { useId, useState } from 'react';
import { CalendarClock, Coffee, Copy, LayoutGrid, Plus, Trash2, Wand2 } from 'lucide-react';
import type { BlockKind, ScheduleData } from '@/types/schedule';
import {
  addBlock, blocksFor, copyBlocks, dayLayoutId, dayWindow, defaultBlockLabel, fillSlots, isDayLayoutSet, layoutsFor, listSpaces,
  removeBlock, setDayLayout, setLayoutForAllDays, updateBlock,
} from '@/lib/schedule';
import type { Result, ScheduleContext } from '@/lib/schedule';
import { formatDate } from '@/lib/utils';
import { InlineText } from '@/components/common/InlineField';
import { formFieldClass } from '@/components/common/StakeholderSelect';
import { toast } from '@/components/common/Toast';
import { BLOCK_STYLE } from './originStyle';

interface DayStructurePanelProps {
  data: ScheduleData;
  ctx: ScheduleContext;
  days: string[];
  onChange: (next: ScheduleData) => void;
}

const dayLabel = (iso: string) => formatDate(iso).replace(/,? \d{4}$/, '');

const KIND_OPTIONS: { value: BlockKind; label: string; help: string }[] = [
  { value: 'slot', label: 'Session slot', help: 'Where sessions go.' },
  { value: 'break', label: 'Break or lunch', help: 'Across every room. No sessions.' },
  { value: 'event', label: 'All-attendee event', help: 'A keynote or reception for everyone. No sessions.' },
];

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

export const DayStructurePanel: React.FC<DayStructurePanelProps> = ({ data, ctx, days, onChange }) => {
  const uid = useId();
  const [day, setDay] = useState(days[0] ?? '');
  const activeDay = days.includes(day) ? day : (days[0] ?? '');
  const blocks = blocksFor(data, activeDay);
  const w = dayWindow(data, ctx);
  const spaces = listSpaces(data);
  const step = data.settings.slotMinutes * 60;

  const [kind, setKind] = useState<BlockKind>('break');
  const [label, setLabel] = useState('BREAK');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [slotLength, setSlotLength] = useState(60);

  const apply = (result: Result<ScheduleData>): boolean => {
    if (result.ok === false) {
      toast.error(result.error, 'Not changed');
      return false;
    }
    onChange(result.data);
    return true;
  };

  const preset = (k: BlockKind, text: string) => {
    setKind(k);
    setLabel(text);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apply(addBlock(data, ctx, activeDay, { kind, label, start, end }))) {
      setStart('');
      setEnd('');
    }
  };

  const ownHours = !!(data.settings.dayStart || data.settings.dayEnd);

  return (
    <div className="space-y-4">
      <Section id={`${uid}-hours`} title="Hours" icon={<CalendarClock className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />} >
        <p className="text-xs text-[#252a2e]">
          {days.length > 0 ? (
            <>
              The event runs <span className="font-semibold">{dayLabel(days[0])}</span>
              {days.length > 1 && <> to <span className="font-semibold">{dayLabel(days[days.length - 1])}</span></>}, and the agenda covers{' '}
              <span className="font-mono font-semibold tabular-nums">{w.startText}</span> to <span className="font-mono font-semibold tabular-nums">{w.endText}</span> each day
              {w.fromEvent ? ', the event\'s own hours.' : '.'}
              {w.eventHoursUnusable && ctx.eventHours && (
                <> The event\'s hours ({ctx.eventHours.start} to {ctx.eventHours.end}) cannot be used for a single-day agenda, so the default is in force.</>
              )}
            </>
          ) : (
            'The event has no dates yet, so there are no days to schedule.'
          )}
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#46535e]">
            <input
              type="checkbox"
              checked={ownHours}
              onChange={(e) =>
                onChange({
                  ...data,
                  settings: e.target.checked ? { ...data.settings, dayStart: w.startText, dayEnd: w.endText } : { slotMinutes: data.settings.slotMinutes },
                })
              }
              className="accent-[#0063a3]"
            />
            Schedule outside the event&rsquo;s hours
          </label>
          {ownHours && (
            <>
              <div>
                <label htmlFor={`${uid}-ds`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Starts</label>
                <input id={`${uid}-ds`} type="time" value={data.settings.dayStart ?? ''} onChange={(e) => e.target.value && onChange({ ...data, settings: { ...data.settings, dayStart: e.target.value } })} className={`${formFieldClass} w-32 font-mono`} />
              </div>
              <div>
                <label htmlFor={`${uid}-de`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Ends</label>
                <input id={`${uid}-de`} type="time" value={data.settings.dayEnd ?? ''} onChange={(e) => e.target.value && onChange({ ...data, settings: { ...data.settings, dayEnd: e.target.value } })} className={`${formFieldClass} w-32 font-mono`} />
              </div>
            </>
          )}
          <div>
            <label htmlFor={`${uid}-sn`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Snap to</label>
            <select id={`${uid}-sn`} value={data.settings.slotMinutes} onChange={(e) => onChange({ ...data, settings: { ...data.settings, slotMinutes: Number(e.target.value) } })} className={`${formFieldClass} w-36 cursor-pointer`}>
              {[5, 10, 15, 30].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section
        id={`${uid}-structure`}
        title="Structure of each day"
        icon={<Coffee className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />}
        hint="Breaks and events take no sessions. A session dropped in a slot lands at its start."
      >
        {days.length > 0 && (
          <div role="tablist" aria-label="Day" className="flex flex-wrap gap-1">
            {days.map((d, i) => (
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
                {dayLabel(d)} <span className="font-mono tabular-nums opacity-80">{blocksFor(data, d).length}</span>
              </button>
            ))}
          </div>
        )}

        {blocks.length === 0 ? (
          <p className="rounded border border-dashed border-[#c5ccd3] px-3 py-5 text-center text-[11px] text-[#5b6770]">
            Nothing set for {activeDay ? dayLabel(activeDay) : 'this day'}. Until you add something, sessions can go at any time.
          </p>
        ) : (
          <ul className="divide-y divide-[#e7eaef] rounded border border-[#e7eaef]">
            {blocks.map((b) => {
              const tone = b.kind === 'slot' ? null : BLOCK_STYLE[b.kind];
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2" style={tone ? { background: tone.bg } : undefined}>
                  <select
                    aria-label={`Type of ${b.label} at ${b.start}`}
                    value={b.kind}
                    onChange={(e) => apply(updateBlock(data, ctx, activeDay, b.id, { kind: e.target.value as BlockKind }))}
                    className={`${formFieldClass} w-44 cursor-pointer`}
                  >
                    {KIND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <div className="w-56">
                    <InlineText value={b.label} label={`Label of the block at ${b.start}`} required requiredMessage="A block needs a label." semibold onCommit={(v) => apply(updateBlock(data, ctx, activeDay, b.id, { label: v }))} className="bg-white/70" />
                  </div>
                  <label className="flex items-center gap-1 text-[11px] text-[#46535e]">
                    From
                    <input type="time" step={step} aria-label={`Start of ${b.label} at ${b.start}`} value={b.start} onChange={(e) => e.target.value && apply(updateBlock(data, ctx, activeDay, b.id, { start: e.target.value }))} className={`${formFieldClass} w-28 font-mono`} />
                  </label>
                  <label className="flex items-center gap-1 text-[11px] text-[#46535e]">
                    To
                    <input type="time" step={step} aria-label={`End of ${b.label} at ${b.start}`} value={b.end} onChange={(e) => e.target.value && apply(updateBlock(data, ctx, activeDay, b.id, { end: e.target.value }))} className={`${formFieldClass} w-28 font-mono`} />
                  </label>
                  <button type="button" onClick={() => apply(removeBlock(data, activeDay, b.id))} aria-label={`Remove ${b.label} at ${b.start}`} title="Remove" className="focus-ring ml-auto cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={submit} aria-label="Add to the day" className="space-y-2 rounded border border-[#e7eaef] bg-[#f8f9fa] p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[#252a2e]">Quick add:</span>
            {[
              { k: 'break' as const, t: 'BREAK', text: 'Break' },
              { k: 'break' as const, t: 'LUNCH', text: 'Lunch' },
              { k: 'event' as const, t: 'Event (all attendees)', text: 'All-attendee event' },
              { k: 'slot' as const, t: defaultBlockLabel('slot'), text: 'Session slot' },
            ].map((p) => (
              <button key={p.text} type="button" onClick={() => preset(p.k, p.t)} className="focus-ring cursor-pointer rounded border border-[#d8dce0] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#46535e] hover:border-[#0063a3] hover:text-[#0063a3]">
                {p.text}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor={`${uid}-k`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Type</label>
              <select id={`${uid}-k`} value={kind} onChange={(e) => setKind(e.target.value as BlockKind)} className={`${formFieldClass} w-44 cursor-pointer`}>
                {KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="w-56">
              <label htmlFor={`${uid}-l`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Label</label>
              <input id={`${uid}-l`} type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={formFieldClass} />
            </div>
            <div>
              <label htmlFor={`${uid}-s`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">From</label>
              <input id={`${uid}-s`} type="time" step={step} value={start} onChange={(e) => setStart(e.target.value)} className={`${formFieldClass} w-28 font-mono`} />
            </div>
            <div>
              <label htmlFor={`${uid}-e`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">To</label>
              <input id={`${uid}-e`} type="time" step={step} value={end} onChange={(e) => setEnd(e.target.value)} className={`${formFieldClass} w-28 font-mono`} />
            </div>
            <button type="submit" disabled={!activeDay} className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084] disabled:cursor-default disabled:opacity-50">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add to {activeDay ? dayLabel(activeDay) : 'the day'}
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-end gap-3 border-t border-[#e7eaef] pt-3">
          <div>
            <label htmlFor={`${uid}-fl`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Slot length</label>
            <select id={`${uid}-fl`} value={slotLength} onChange={(e) => setSlotLength(Number(e.target.value))} className={`${formFieldClass} w-32 cursor-pointer`}>
              {[30, 45, 60, 75, 90].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
          <button type="button" disabled={!activeDay} onClick={() => apply(fillSlots(data, ctx, activeDay, slotLength))} className="focus-ring flex cursor-pointer items-center gap-1 rounded border border-[#0063a3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0063a3] hover:bg-[#e5f2f8] disabled:cursor-default disabled:opacity-50">
            <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
            Fill the gaps with slots
          </button>
          <button
            type="button"
            disabled={days.length < 2 || blocks.length === 0}
            onClick={() => {
              if (apply(copyBlocks(data, activeDay, days))) toast.success(`Every day now has the structure of ${dayLabel(activeDay)}.`);
            }}
            className="focus-ring flex cursor-pointer items-center gap-1 rounded border border-[#d8dce0] bg-white px-3 py-1.5 text-xs font-semibold text-[#46535e] hover:border-[#0063a3] hover:text-[#0063a3] disabled:cursor-default disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Use this structure on every day
          </button>
        </div>
      </Section>

      {spaces.length > 0 && days.length > 0 && (
        <Section id={`${uid}-setup`} title="Room setup by day" icon={<LayoutGrid className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />} hint="Each room has one layout per day.">
          <div className="overflow-x-auto rounded border border-[#e7eaef]">
            <table className="w-full min-w-[560px] text-left text-xs">
              <caption className="sr-only">Layout of each room on each day</caption>
              <thead className="bg-[#f8f9fa] text-[11px] text-[#5b6770]">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Room</th>
                  <th scope="col" className="px-2 py-2 font-semibold">Every day</th>
                  {days.map((d) => (
                    <th key={d} scope="col" className="px-2 py-2 font-semibold">{dayLabel(d)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e7eaef]">
                {spaces.map((sp) => {
                  const offered = layoutsFor(data, sp.id);
                  return (
                    <tr key={sp.id} className={sp.kind === 'combination' ? 'bg-[#f8f9fa]' : undefined}>
                      <th scope="row" className="px-3 py-1.5 font-semibold text-[#252a2e]">
                        {sp.name}
                        {sp.kind === 'combination' && <span className="ml-1.5 font-normal text-[#5b6770]">(joined)</span>}
                      </th>
                      {offered.length === 0 ? (
                        <td colSpan={days.length + 1} className="px-2 py-1.5 text-[11px] text-[#5b6770]">No layouts set up. Add capacities in Rooms &amp; layouts.</td>
                      ) : (
                        <>
                          <td className="px-2 py-1">
                            <select
                              aria-label={`${sp.name}, every day`}
                              value=""
                              onChange={(e) => e.target.value && apply(setLayoutForAllDays(data, days, sp.id, e.target.value))}
                              className={`${formFieldClass} w-36 cursor-pointer`}
                            >
                              <option value="">Set all&hellip;</option>
                              {offered.map(({ layout }) => (
                                <option key={layout.id} value={layout.id}>{layout.name}</option>
                              ))}
                            </select>
                          </td>
                          {days.map((d) => {
                            const current = dayLayoutId(data, d, sp.id);
                            const explicit = isDayLayoutSet(data, d, sp.id);
                            return (
                              <td key={d} className="px-2 py-1">
                                <select
                                  aria-label={`${sp.name} on ${dayLabel(d)}`}
                                  value={current ?? ''}
                                  onChange={(e) => apply(setDayLayout(data, d, sp.id, e.target.value || null))}
                                  title={explicit ? undefined : 'Not set: using the first layout the room offers'}
                                  className={`${formFieldClass} w-36 cursor-pointer ${explicit ? '' : 'text-[#5b6770]'}`}
                                >
                                  {offered.map(({ layout, capacity }) => (
                                    <option key={layout.id} value={layout.id}>
                                      {layout.name} ({capacity}){layout.id === current && !explicit ? ' (default)' : ''}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
};
