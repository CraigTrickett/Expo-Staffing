import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, FolderOpen, Mail, Plus, Search, Trash2, X } from 'lucide-react';
import type { EventConfig } from '@/types';
import type { ResourceItem, ResourcesData } from '@/types/resources';
import type { StakeholderRef } from '@/types/stakeholderRef';
import { usePageFocus } from '@/lib/hooks';
import { useModuleData } from '@/lib/useModuleData';
import { getStakeholders } from '@/lib/stakeholders';
import { classifyLink } from '@/lib/links';
import { describeStakeholderRef, resolveStakeholderRef } from '@/lib/stakeholderRef';
import {
  checkUrl, createEmptyResources, createResource, DEFAULT_CATEGORY_ID, filterResources, groupByCategory, normaliseResources,
  resourceCategories, RESOURCES_MODULE_ID,
} from '@/lib/resources';
import { InlineText, inlineFieldClass } from '@/components/common/InlineField';
import { SaveStatus } from '@/components/common/SaveStatus';
import { StakeholderSelect, formFieldClass } from '@/components/common/StakeholderSelect';
import { toast } from '@/components/common/Toast';

interface ResourcesPageProps {
  event: EventConfig;
  onBack: () => void;
  onManageStakeholders?: () => void;
}

export const ResourcesPage: React.FC<ResourcesPageProps> = ({ event, onBack, onManageStakeholders }) => {
  const uid = useId();
  const modalRef = usePageFocus();
  const stakeholders = useMemo(() => getStakeholders(event.id), [event.id]);
  const categories = useMemo(() => resourceCategories(), []);
  const { data, commit, saveState } = useModuleData<ResourcesData>(
    event.id,
    RESOURCES_MODULE_ID,
    createEmptyResources,
    (raw) => normaliseResources(raw as Partial<ResourcesData>)
  );

  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [owner, setOwner] = useState<StakeholderRef | null>(null);
  const [notes, setNotes] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);

  const [filterCategory, setFilterCategory] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [query, setQuery] = useState('');
  const [removed, setRemoved] = useState<ResourceItem | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(t);
  }, [removed]);

  const shown = filterResources(data.resources, { categoryId: filterCategory, ownerId: filterOwner, query });
  const groups = groupByCategory(shown);
  const filtering = !!(filterCategory || filterOwner || query.trim());
  // Only categories and people that are actually used are worth offering as filters.
  const usedCategories = categories.filter((c) => data.resources.some((r) => r.categoryId === c.id));
  const usedOwners = Array.from(new Map(data.resources.map((r) => [r.owner.id, r.owner])).values()).sort((a, b) => a.name.localeCompare(b.name));

  const update = (id: string, patch: Partial<ResourceItem>) =>
    commit((prev) => ({ resources: prev.resources.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const made = createResource({ title, url, categoryId, owner, notes });
    if (made.ok === false) {
      toast.error(made.error, 'Not added');
      return;
    }
    commit((prev) => ({ resources: [...prev.resources, made.data] }));
    setAnnouncement(`Added ${made.data.title} under ${categories.find((c) => c.id === made.data.categoryId)?.title}.`);
    setTitle('');
    setUrl('');
    setNotes('');
    titleRef.current?.focus();
  };

  const remove = (r: ResourceItem) => {
    commit((prev) => ({ resources: prev.resources.filter((x) => x.id !== r.id) }));
    setRemoved(r);
    setAnnouncement(`Removed ${r.title}. Undo is available.`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section ref={modalRef} tabIndex={-1} aria-labelledby={`${uid}-title`} className="flex flex-col rounded border border-[#d8dce0] bg-white shadow-xs focus:outline-hidden">
        <div className="p-4 sm:p-5 border-b border-[#d8dce0] bg-[#f8f9fa]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <button type="button" onClick={onBack} className="focus-ring p-2 rounded text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#b9dcf0] bg-white transition-colors cursor-pointer" title="Back to menu" aria-label="Back to menu">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-xs text-[#46535e]">{event.title}</p>
                <h1 id={`${uid}-title`} className="text-lg font-bold text-[#252a2e] mt-0.5 flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-[#0063a3]" aria-hidden="true" />
                  <span>Resources</span>
                </h1>
                <SaveStatus state={saveState} className="mt-1" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f8f9fa] p-4 sm:p-5 space-y-4">
          <form onSubmit={add} aria-label="Add a resource" className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#252a2e]">Add a resource</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label htmlFor={`${uid}-t`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Title *</label>
                <input id={`${uid}-t`} ref={titleRef} type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Venue floor plan" className={formFieldClass} />
              </div>
              <div>
                <label htmlFor={`${uid}-u`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Link *</label>
                <input id={`${uid}-u`} type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/..." className={formFieldClass} />
              </div>
              <div>
                <label htmlFor={`${uid}-c`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Category *</label>
                <select id={`${uid}-c`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={`${formFieldClass} cursor-pointer`}>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${uid}-o`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Key stakeholder *</label>
                <StakeholderSelect id={`${uid}-o`} label="Key stakeholder for the new resource" value={owner} stakeholders={stakeholders} onChange={setOwner} emptyLabel="Choose a key stakeholder" required />
                {stakeholders.length === 0 && (
                  <p className="mt-0.5 text-[11px] text-[#5b6770]">
                    No key stakeholders yet.{' '}
                    {onManageStakeholders && (
                      <button type="button" onClick={onManageStakeholders} className="focus-ring cursor-pointer rounded font-semibold text-[#0063a3] underline">Add one</button>
                    )}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label htmlFor={`${uid}-n`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Notes</label>
                <input id={`${uid}-n`} type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" className={formFieldClass} />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Add resource
              </button>
            </div>
          </form>

          {data.resources.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#5b6770]" aria-hidden="true" />
                <label htmlFor={`${uid}-q`} className="sr-only">Search resources</label>
                <input id={`${uid}-q`} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, notes or stakeholder" className={`${formFieldClass} pl-7`} />
              </div>
              <label className="flex items-center gap-1.5 text-[#46535e]">
                Category
                <select aria-label="Filter by category" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={`${formFieldClass} w-52 cursor-pointer`}>
                  <option value="">All categories</option>
                  {usedCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[#46535e]">
                Stakeholder
                <select aria-label="Filter by stakeholder" value={filterOwner} onChange={(e) => setFilterOwner(e.target.value)} className={`${formFieldClass} w-48 cursor-pointer`}>
                  <option value="">Anyone</option>
                  {usedOwners.map((o) => (
                    <option key={o.id} value={o.id}>{describeStakeholderRef(o, stakeholders)}</option>
                  ))}
                </select>
              </label>
              <span className="text-[11px] text-[#5b6770]">{shown.length} of {data.resources.length}</span>
            </div>
          )}

          {data.resources.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded border border-dashed border-[#c5ccd3] bg-white px-4 py-12 text-center">
              <FolderOpen className="h-5 w-5 text-[#5b6770]" aria-hidden="true" />
              <p className="text-xs font-semibold text-[#252a2e]">No resources yet</p>
              
            </div>
          ) : groups.length === 0 ? (
            <p className="rounded border border-dashed border-[#c5ccd3] bg-white px-3 py-8 text-center text-[11px] text-[#5b6770]">
              {filtering ? 'No resources match.' : 'No resources.'}
            </p>
          ) : (
            groups.map((g) => (
              <section key={g.category.id} aria-labelledby={`${uid}-g-${g.category.id}`}>
                <h2 id={`${uid}-g-${g.category.id}`} className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#46535e]">
                  {g.category.title}
                  <span className="rounded bg-[#e7eaef] px-1.5 py-0.5 font-mono text-[11px] font-semibold normal-case tracking-normal text-[#46535e]">{g.resources.length}</span>
                </h2>
                <ul className="divide-y divide-[#e7eaef] rounded border border-[#d8dce0] bg-white shadow-2xs">
                  {g.resources.map((r) => {
                    const kind = classifyLink(r.url);
                    const person = resolveStakeholderRef(r.owner, stakeholders);
                    return (
                      <li key={r.id} className="space-y-1 px-3 py-2.5">
                        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                          <div className="min-w-[200px] flex-1">
                            <InlineText value={r.title} label={`Title of resource ${r.title}`} required requiredMessage="A resource needs a title." semibold onCommit={(v) => update(r.id, { title: v })} />
                          </div>
                          <span className="mt-1 rounded border border-[#d8dce0] bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-semibold text-[#46535e]">{kind.label}</span>
                          <div className="w-52">
                            <select
                              aria-label={`Category of ${r.title}`}
                              value={categories.some((c) => c.id === r.categoryId) ? r.categoryId : ''}
                              onChange={(e) => e.target.value && update(r.id, { categoryId: e.target.value })}
                              className={`${inlineFieldClass} cursor-pointer`}
                            >
                              {!categories.some((c) => c.id === r.categoryId) && <option value="">Choose a category</option>}
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.title}</option>
                              ))}
                            </select>
                          </div>
                          <div className="w-52">
                            <StakeholderSelect variant="inline" label={`Key stakeholder of ${r.title}`} value={r.owner} stakeholders={stakeholders} onChange={(ref) => ref && update(r.id, { owner: ref })} emptyLabel="Choose a key stakeholder" />
                          </div>
                          <button type="button" onClick={() => remove(r)} aria-label={`Remove resource ${r.title}`} title="Remove resource" className="focus-ring mt-0.5 cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]">
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="min-w-[240px] flex-1">
                            <InlineText
                              value={r.url}
                              label={`Link of ${r.title}`}
                              className="font-mono text-[11px]"
                              onCommit={(v) => {
                                const checked = checkUrl(v);
                                if ('error' in checked) {
                                  toast.error(checked.error, 'Link not saved');
                                  return false;
                                }
                                update(r.id, { url: checked.url });
                                return true;
                              }}
                            />
                          </div>
                          <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.title} in a new tab`} className="focus-ring flex items-center gap-1 rounded px-1 text-xs font-semibold text-[#0063a3] underline hover:text-[#004f83]">
                            Open <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                          {person?.stakeholder?.email && (
                            <a href={`mailto:${person.stakeholder.email}`} aria-label={`Email ${person.name}`} className="focus-ring flex items-center gap-1 rounded px-1 text-xs font-semibold text-[#0063a3] underline hover:text-[#004f83]">
                              <Mail className="h-3 w-3" aria-hidden="true" /> {person.name}
                            </a>
                          )}
                          {person?.removed && <span className="text-[11px] font-semibold text-[#6e4600]">{person.name} was removed from Key Stakeholders. Choose someone else.</span>}
                        </div>
                        <InlineText multiline value={r.notes ?? ''} label={`Notes for ${r.title}`} placeholder="Add notes" onCommit={(v) => update(r.id, { notes: v || undefined })} className="text-[11px]" />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}

          {removed && (
            <div role="status" className="flex items-center justify-between gap-3 rounded border border-[#d8dce0] bg-white px-3 py-2 text-xs text-[#252a2e] animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
              <span className="min-w-0 truncate">Removed <span className="font-semibold">&ldquo;{removed.title}&rdquo;</span></span>
              <button
                type="button"
                onClick={() => {
                  commit((prev) => ({ resources: [...prev.resources, removed] }));
                  setAnnouncement(`Restored ${removed.title}.`);
                  setRemoved(null);
                }}
                className="focus-ring shrink-0 cursor-pointer rounded px-2 py-0.5 font-semibold text-[#0063a3] hover:bg-[#e5f2f8]"
              >
                Undo
              </button>
            </div>
          )}

          <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
        </div>
      </section>
    </div>
  );
};
