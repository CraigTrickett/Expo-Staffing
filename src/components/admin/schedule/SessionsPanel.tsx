import React, { useId, useMemo, useState } from 'react';
import { ChevronRight, Plus, Search } from 'lucide-react';
import type { KeyStakeholder } from '@/types';
import type { ScheduleData, ScheduleSession, SessionOrigin } from '@/types/schedule';
import type { StakeholderRef } from '@/types/stakeholderRef';
import { allTags, getSpace, isScheduled, listSpaces, sessionEnd, sessionLabel } from '@/lib/schedule';
import type { SessionInput } from '@/lib/schedule';
import { formatDate } from '@/lib/utils';
import { formFieldClass } from '@/components/common/StakeholderSelect';
import { OriginPicker } from './OriginPicker';
import { ORIGIN_STYLE } from './originStyle';
import { SpeakerPicker } from './SpeakerPicker';
import { TagInput } from './TagInput';

interface SessionsPanelProps {
  data: ScheduleData;
  stakeholders: KeyStakeholder[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Returns the new session's id, or null if it was refused. */
  onAdd: (input: SessionInput) => string | null;
  onManageStakeholders?: () => void;
  /** Renders the editor for one session. */
  renderEditor: (session: ScheduleSession) => React.ReactNode;
}

export const SessionsPanel: React.FC<SessionsPanelProps> = ({ data, stakeholders, selectedId, onSelect, onAdd, onManageStakeholders, renderEditor }) => {
  const uid = useId();
  const spaces = listSpaces(data);
  const [code, setCode] = useState('');
  const [origin, setOrigin] = useState<SessionOrigin>('internal');
  const [guests, setGuests] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [url, setUrl] = useState('');
  const [speakers, setSpeakers] = useState<StakeholderRef[]>([]);
  const [length, setLength] = useState(45);
  const [spaceId, setSpaceId] = useState('');
  const [query, setQuery] = useState('');
  const [onlyUnplaced, setOnlyUnplaced] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = onAdd({ code, title, abstract, presentationUrl: url, origin, speakers, guests, tags, durationMinutes: length, spaceId: spaceId || undefined });
    if (id) {
      setCode('');
      setGuests('');
      setTags([]);
      setTitle('');
      setAbstract('');
      setUrl('');
      setSpeakers([]);
      onSelect(id);
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.sessions
      .filter((s) => !onlyUnplaced || !isScheduled(s))
      .filter((s) => !q || `${s.title} ${s.speakers.map((x) => x.name).join(' ')}`.toLowerCase().includes(q))
      .sort((a, b) => `${a.date ?? '9999'} ${a.startTime ?? ''} ${a.title}`.localeCompare(`${b.date ?? '9999'} ${b.startTime ?? ''} ${b.title}`));
  }, [data.sessions, query, onlyUnplaced]);

  return (
    <div className="space-y-4">
      <form onSubmit={submit} aria-label="Add a session" className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#252a2e]">New session</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-c`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Session code</label>
            <input id={`${uid}-c`} type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="D-1805" className={`${formFieldClass} font-mono`} />
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Internal or external</span>
            <OriginPicker label="New session" value={origin} onChange={setOrigin} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor={`${uid}-t`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Title *</label>
            <input id={`${uid}-t`} type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={formFieldClass} />
          </div>
          <div className="md:col-span-2">
            <label htmlFor={`${uid}-a`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Abstract</label>
            <textarea id={`${uid}-a`} rows={3} value={abstract} onChange={(e) => setAbstract(e.target.value)} className={`${formFieldClass} resize-y`} />
          </div>
          <div>
            <label htmlFor={`${uid}-u`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Link to the presentation</label>
            <input id={`${uid}-u`} type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/presentation/..." className={formFieldClass} />
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Stakeholders</span>
            <SpeakerPicker label="New session" speakers={speakers} stakeholders={stakeholders} onChange={setSpeakers} onManageStakeholders={onManageStakeholders} />
          </div>
          <div>
            <label htmlFor={`${uid}-g`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Other presenters</label>
            <input id={`${uid}-g`} type="text" value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="A customer or partner presenter, and company" className={formFieldClass} />
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Tags</span>
            <TagInput label="New session" tags={tags} suggestions={allTags(data)} onChange={setTags} />
          </div>
          <div>
            <label htmlFor={`${uid}-l`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Length</label>
            <select id={`${uid}-l`} value={length} onChange={(e) => setLength(Number(e.target.value))} className={`${formFieldClass} cursor-pointer`}>
              {[15, 20, 30, 45, 60, 75, 90, 120].map((m) => (
                <option key={m} value={m}>{m} minutes</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${uid}-r`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Room</label>
            <select id={`${uid}-r`} value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className={`${formFieldClass} cursor-pointer`}>
              <option value="">No room yet</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.kind === 'combination' ? ' (joined)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add session
          </button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5b6770]" aria-hidden="true" />
          <label htmlFor={`${uid}-q`} className="sr-only">Search sessions</label>
          <input id={`${uid}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title or speaker" className={`${formFieldClass} pl-7`} />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[#46535e]">
          <input type="checkbox" checked={onlyUnplaced} onChange={(e) => setOnlyUnplaced(e.target.checked)} className="accent-[#0063a3]" />
          Only sessions not on the agenda
        </label>
        <span className="text-[11px] text-[#5b6770]">{shown.length} of {data.sessions.length}</span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded border border-dashed border-[#c5ccd3] bg-white px-3 py-8 text-center text-[11px] text-[#5b6770]">
          {data.sessions.length === 0 ? 'No sessions yet. Add the first one above.' : 'No sessions match.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((s) => {
            const open = selectedId === s.id;
            const space = getSpace(data, s.spaceId);
            return (
              <li key={s.id} className="rounded border border-[#d8dce0] bg-white shadow-2xs">
                <button
                  type="button"
                  onClick={() => onSelect(open ? null : s.id)}
                  aria-expanded={open}
                  aria-label={`${open ? 'Close' : 'Edit'} ${s.title}`}
                  className="focus-ring flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left"
                >
                  <ChevronRight className={`h-4 w-4 shrink-0 text-[#5b6770] transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-[#252a2e]">{sessionLabel(s)}</span>
                      <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: ORIGIN_STYLE[s.origin].bg, borderColor: ORIGIN_STYLE[s.origin].border, color: ORIGIN_STYLE[s.origin].text }}>
                        {ORIGIN_STYLE[s.origin].label}
                      </span>
                      {s.fixed && <span className="rounded border border-dashed border-[#b8860b] bg-[#fff6cf] px-1.5 py-0.5 text-[11px] font-semibold text-[#4d3800]">Fixed</span>}
                      {s.tags.map((t) => (
                        <span key={t} className="rounded border border-[#d8dce0] bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-semibold text-[#46535e]">{t}</span>
                      ))}
                    </span>
                    <span className="block truncate text-[11px] text-[#5b6770]">
                      {isScheduled(s) ? `${formatDate(s.date as string)}, ${s.startTime}\u2013${sessionEnd(s)}` : 'Not on the agenda'}
                      {space ? ` \u00b7 ${space.name}` : ''}
                      {s.speakers.length > 0 || s.guests ? ` \u00b7 ${[...s.speakers.map((x) => x.name), ...(s.guests ? [s.guests] : [])].join(', ')}` : ' \u00b7 No stakeholder yet'}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#5b6770]">{s.durationMinutes} min</span>
                </button>
                {open && <div className="border-t border-[#e7eaef] bg-[#f8f9fa] p-3">{renderEditor(s)}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
