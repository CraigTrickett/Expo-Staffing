import React, { useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Inbox, Plus, Trash2, X } from 'lucide-react';
import type { EventConfig } from '@/types';
import type { OtherData } from '@/types/other';
import type { TasksData } from '@/types/tasks';
import { ADMIN_MODULES } from '@/data/adminModules';
import { usePageFocus } from '@/lib/hooks';
import { useModuleData } from '@/lib/useModuleData';
import { getStakeholders } from '@/lib/stakeholders';
import { classifyLink } from '@/lib/links';
import { createEmptyOther, createNote, createOtherLink, newestFirst, normaliseOther, OTHER_DATA_MODULE_ID } from '@/lib/other';
import { createEmptyTasks, normaliseTasks, OTHER_MODULE_ID, TASKS_MODULE_ID } from '@/lib/tasks';
import { formatDate } from '@/lib/utils';
import { InlineText, inlineFieldClass } from '@/components/common/InlineField';
import { SaveStatus } from '@/components/common/SaveStatus';
import { formFieldClass } from '@/components/common/StakeholderSelect';
import { TaskList } from '@/components/common/TaskList';
import { toast } from '@/components/common/Toast';

type Tab = 'tasks' | 'notes' | 'links';

interface OtherPageProps {
  event: EventConfig;
  onBack: () => void;
}

/** Every area an item can be tagged to: Other itself first, then the hub modules. */
const AREA_OPTIONS = [
  { id: OTHER_MODULE_ID, title: 'Other' },
  ...ADMIN_MODULES.filter((m) => m.id !== 'overview' && m.id !== 'other').map((m) => ({ id: m.id, title: m.title })),
];

export const OtherPage: React.FC<OtherPageProps> = ({ event, onBack }) => {
  const uid = useId();
  const modalRef = usePageFocus();
  const stakeholders = useMemo(() => getStakeholders(event.id), [event.id]);
  const tasks = useModuleData<TasksData>(event.id, TASKS_MODULE_ID, createEmptyTasks, (raw) => normaliseTasks(raw as Partial<TasksData>));
  const other = useModuleData<OtherData>(event.id, OTHER_DATA_MODULE_ID, createEmptyOther, (raw) => normaliseOther(raw as Partial<OtherData>));

  const [tab, setTab] = useState<Tab>('tasks');
  const [status, setStatus] = useState<'open' | 'all'>('open');
  const [area, setArea] = useState('');

  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteArea, setNoteArea] = useState(OTHER_MODULE_ID);
  const noteTitleRef = useRef<HTMLInputElement>(null);

  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkArea, setLinkArea] = useState(OTHER_MODULE_ID);

  const areaTitle = (id?: string) => AREA_OPTIONS.find((a) => a.id === id)?.title ?? '';

  const visibleTasks = tasks.data.tasks.filter(
    (t) => (status === 'all' || t.status === 'open') && (!area || (area === '__none' ? !t.moduleId : t.moduleId === area))
  );

  const saveState = tab === 'tasks' ? tasks.saveState : other.saveState;
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'tasks', label: 'Tasks', count: tasks.data.tasks.filter((t) => t.status === 'open').length },
    { id: 'notes', label: 'Notes', count: other.data.notes.length },
    { id: 'links', label: 'Links', count: other.data.links.length },
  ];

  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) {
      toast.error('Give the note a title.', 'Missing field');
      noteTitleRef.current?.focus();
      return;
    }
    other.commit((prev) => ({ ...prev, notes: [createNote({ title: noteTitle, body: noteBody, moduleId: noteArea }), ...prev.notes] }));
    setNoteTitle('');
    setNoteBody('');
  };

  const addLink = (e: React.FormEvent) => {
    e.preventDefault();
    const made = createOtherLink({ title: linkTitle, url: linkUrl, moduleId: linkArea });
    if (made.ok === false) {
      toast.error(made.error, 'Link not added');
      return;
    }
    other.commit((prev) => ({ ...prev, links: [made.link, ...prev.links] }));
    setLinkTitle('');
    setLinkUrl('');
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section ref={modalRef} tabIndex={-1} aria-labelledby="other-modal-title" className="flex flex-col rounded border border-[#d8dce0] bg-white shadow-xs focus:outline-hidden">
        <div className="p-4 sm:p-5 border-b border-[#d8dce0] bg-[#f8f9fa]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <button type="button" onClick={onBack} className="focus-ring p-2 rounded text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#b9dcf0] bg-white transition-colors cursor-pointer" title="Back to menu" aria-label="Back to menu">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-xs text-[#46535e]">{event.title}</p>
                <h1 id="other-modal-title" className="text-lg font-bold text-[#252a2e] mt-0.5 flex items-center gap-2">
                  <Inbox className="w-5 h-5 text-[#0063a3]" aria-hidden="true" />
                  <span>Other</span>
                </h1>
                <SaveStatus state={saveState} className="mt-1" />
              </div>
            </div>
          </div>

          <div role="tablist" aria-label="Other" className="mt-4 flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`${uid}-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`${uid}-panel-${t.id}`}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => {
                  const order = tabs.map((x) => x.id);
                  const i = order.indexOf(tab);
                  if (e.key === 'ArrowRight') setTab(order[(i + 1) % order.length]);
                  if (e.key === 'ArrowLeft') setTab(order[(i + order.length - 1) % order.length]);
                }}
                tabIndex={tab === t.id ? 0 : -1}
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
          {tab === 'tasks' && (
            <div role="tabpanel" id={`${uid}-panel-tasks`} aria-labelledby={`${uid}-tab-tasks`} className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1.5 text-[#46535e]">
                  Show
                  <select value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'all')} className={`${formFieldClass} w-32`} aria-label="Show tasks">
                    <option value="open">Open only</option>
                    <option value="all">Open and done</option>
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-[#46535e]">
                  Area
                  <select value={area} onChange={(e) => setArea(e.target.value)} className={`${formFieldClass} w-48`} aria-label="Filter tasks by area">
                    <option value="">All areas</option>
                    <option value="__none">No area</option>
                    {AREA_OPTIONS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <TaskList
                heading="Tasks across the event"
                tasks={visibleTasks}
                stakeholders={stakeholders}
                moduleOptions={AREA_OPTIONS}
                onAdd={(task) => tasks.commit((prev) => ({ tasks: [...prev.tasks.filter((t) => t.id !== task.id), task] }))}
                onUpdate={(id, patch) => tasks.commit((prev) => ({ tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))}
                onRemove={(id) => tasks.commit((prev) => ({ tasks: prev.tasks.filter((t) => t.id !== id) }))}
              />
            </div>
          )}

          {tab === 'notes' && (
            <div role="tabpanel" id={`${uid}-panel-notes`} aria-labelledby={`${uid}-tab-notes`} className="space-y-3">
              <form onSubmit={addNote} aria-label="Add note" className="space-y-2 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
                <div className="flex flex-wrap gap-2">
                  <div className="min-w-[200px] flex-1">
                    <label htmlFor={`${uid}-nt`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Title</label>
                    <input id={`${uid}-nt`} ref={noteTitleRef} type="text" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} className={formFieldClass} />
                  </div>
                  <div className="w-48">
                    <label htmlFor={`${uid}-na`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Area</label>
                    <select id={`${uid}-na`} value={noteArea} onChange={(e) => setNoteArea(e.target.value)} className={formFieldClass}>
                      {AREA_OPTIONS.map((a) => (
                        <option key={a.id} value={a.id}>{a.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor={`${uid}-nb`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Note</label>
                  <textarea id={`${uid}-nb`} rows={3} value={noteBody} onChange={(e) => setNoteBody(e.target.value)} className={`${formFieldClass} resize-y`} />
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add note
                  </button>
                </div>
              </form>

              {other.data.notes.length === 0 ? (
                <p className="rounded border border-dashed border-[#c5ccd3] px-3 py-8 text-center text-[11px] text-[#5b6770]">No notes yet.</p>
              ) : (
                <ul className="space-y-2">
                  {newestFirst(other.data.notes).map((note) => (
                    <li key={note.id} className="rounded border border-[#d8dce0] bg-white p-3 shadow-2xs">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <InlineText
                            value={note.title}
                            label={`Title of note ${note.title}`}
                            required
                            requiredMessage="A note needs a title."
                            semibold
                            onCommit={(next) => other.commit((prev) => ({ ...prev, notes: prev.notes.map((n) => (n.id === note.id ? { ...n, title: next, updatedAt: new Date().toISOString() } : n)) }))}
                          />
                          <InlineText
                            multiline
                            value={note.body}
                            label={`Body of note ${note.title}`}
                            placeholder="Add detail"
                            onCommit={(next) => other.commit((prev) => ({ ...prev, notes: prev.notes.map((n) => (n.id === note.id ? { ...n, body: next, updatedAt: new Date().toISOString() } : n)) }))}
                          />
                        </div>
                        <select
                          aria-label={`Area of note ${note.title}`}
                          value={note.moduleId ?? ''}
                          onChange={(e) => other.commit((prev) => ({ ...prev, notes: prev.notes.map((n) => (n.id === note.id ? { ...n, moduleId: e.target.value || undefined } : n)) }))}
                          className={`${inlineFieldClass} w-40 cursor-pointer`}
                        >
                          <option value="">No area</option>
                          {AREA_OPTIONS.map((a) => (
                            <option key={a.id} value={a.id}>{a.title}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => other.commit((prev) => ({ ...prev, notes: prev.notes.filter((n) => n.id !== note.id) }))}
                          aria-label={`Remove note ${note.title}`}
                          title="Remove note"
                          className="focus-ring cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <p className="mt-1 px-2 text-[11px] text-[#5b6770]">Added {formatDate(note.createdAt.slice(0, 10))}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'links' && (
            <div role="tabpanel" id={`${uid}-panel-links`} aria-labelledby={`${uid}-tab-links`} className="space-y-3">
              <form onSubmit={addLink} aria-label="Add link" className="flex flex-wrap items-end gap-2 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
                <div className="w-52">
                  <label htmlFor={`${uid}-lt`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Title</label>
                  <input id={`${uid}-lt`} type="text" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} className={formFieldClass} />
                </div>
                <div className="min-w-[220px] flex-1">
                  <label htmlFor={`${uid}-lu`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Link to a file or page</label>
                  <input id={`${uid}-lu`} type="text" inputMode="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://drive.google.com/..." className={formFieldClass} />
                </div>
                <div className="w-48">
                  <label htmlFor={`${uid}-la`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Area</label>
                  <select id={`${uid}-la`} value={linkArea} onChange={(e) => setLinkArea(e.target.value)} className={formFieldClass}>
                    {AREA_OPTIONS.map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Add link
                </button>
              </form>

              {other.data.links.length === 0 ? (
                <p className="rounded border border-dashed border-[#c5ccd3] px-3 py-8 text-center text-[11px] text-[#5b6770]">No links yet.</p>
              ) : (
                <ul className="divide-y divide-[#e7eaef] rounded border border-[#d8dce0] bg-white shadow-2xs">
                  {newestFirst(other.data.links).map((link) => (
                    <li key={link.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                      <div className="w-56 shrink-0">
                        <InlineText
                          value={link.title}
                          label={`Title of link ${link.title}`}
                          required
                          requiredMessage="A link needs a title."
                          semibold
                          onCommit={(next) => other.commit((prev) => ({ ...prev, links: prev.links.map((l) => (l.id === link.id ? { ...l, title: next } : l)) }))}
                        />
                      </div>
                      <span className="rounded border border-[#d8dce0] bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-semibold text-[#46535e]">{classifyLink(link.url).label}</span>
                      {link.moduleId && <span className="text-[11px] text-[#5b6770]">{areaTitle(link.moduleId)}</span>}
                      <a href={link.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${link.title} in a new tab`} className="focus-ring flex min-w-0 flex-1 items-center gap-1 truncate rounded text-xs font-semibold text-[#0063a3] underline hover:text-[#004f83]">
                        <span className="truncate">{link.url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                      <button
                        type="button"
                        onClick={() => other.commit((prev) => ({ ...prev, links: prev.links.filter((l) => l.id !== link.id) }))}
                        aria-label={`Remove link ${link.title}`}
                        title="Remove link"
                        className="focus-ring cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
