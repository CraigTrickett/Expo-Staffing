import React, { useId, useMemo, useState } from 'react';
import { ExternalLink, Link2, Mail, Plus, Trash2, UserRound } from 'lucide-react';
import type { EventConfig, KeyStakeholder } from '@/types';
import type { EssentialsData } from '@/types/essentials';
import type { TasksData } from '@/types/tasks';
import { addLink, createEmptyEssentials, ESSENTIALS_MODULE_ID, getEssentials, normaliseEssentials, presetFor, removeLink, setContact, updateLink } from '@/lib/essentials';
import { classifyLink } from '@/lib/links';
import { createEmptyTasks, normaliseTasks, tasksForModule, TASKS_MODULE_ID } from '@/lib/tasks';
import { getStakeholders } from '@/lib/stakeholders';
import { resolveStakeholderRef } from '@/lib/stakeholderRef';
import { useModuleData } from '@/lib/useModuleData';
import { InlineText } from '@/components/common/InlineField';
import { SaveStatus } from '@/components/common/SaveStatus';
import { StakeholderSelect, formFieldClass } from '@/components/common/StakeholderSelect';
import { TaskList } from '@/components/common/TaskList';
import { toast } from '@/components/common/Toast';

interface ModuleEssentialsPanelProps {
  event: EventConfig;
  moduleId: string;
  moduleTitle: string;
  onManageStakeholders?: () => void;
}

/**
 * What any module can carry before it has tools of its own: links to the
 * documents it depends on, one key stakeholder to ask, and its tasks. Wording
 * comes from the module's preset, so Badging says "Signup questionnaire".
 */
export const ModuleEssentialsPanel: React.FC<ModuleEssentialsPanelProps> = ({ event, moduleId, moduleTitle, onManageStakeholders }) => {
  const uid = useId();
  const preset = presetFor(moduleId);
  const stakeholders: KeyStakeholder[] = useMemo(() => getStakeholders(event.id), [event.id]);

  const essentials = useModuleData<EssentialsData>(event.id, ESSENTIALS_MODULE_ID, createEmptyEssentials, (raw) => normaliseEssentials(raw as Partial<EssentialsData>));
  const tasks = useModuleData<TasksData>(event.id, TASKS_MODULE_ID, createEmptyTasks, (raw) => normaliseTasks(raw as Partial<TasksData>));

  const mine = getEssentials(essentials.data, moduleId);
  const contact = resolveStakeholderRef(mine.contact, stakeholders);
  const moduleTasks = tasksForModule(tasks.data.tasks, moduleId);

  const [label, setLabel] = useState(preset.linkLabel);
  const [url, setUrl] = useState('');

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    const result = addLink(essentials.data, moduleId, label, url);
    if (result.ok === false) {
      toast.error(result.error, 'Link not added');
      return;
    }
    essentials.commit(result.data);
    setUrl('');
    setLabel(preset.linkLabel);
  };

  return (
    <div className="space-y-4">
      <SaveStatus state={essentials.saveState} />

      <section aria-labelledby={`${uid}-links`} className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
        <div>
          <h2 id={`${uid}-links`} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#252a2e]">
            <Link2 className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />
            Links
          </h2>
          
        </div>

        {mine.links.length > 0 && (
          <ul className="divide-y divide-[#e7eaef] rounded border border-[#e7eaef]">
            {mine.links.map((link) => {
              const kind = classifyLink(link.url);
              return (
                <li key={link.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <div className="w-52 shrink-0">
                    <InlineText
                      value={link.label}
                      label={`Label of link ${link.label}`}
                      required
                      requiredMessage="A link needs a label."
                      semibold
                      onCommit={(next) => {
                        const r = updateLink(essentials.data, moduleId, link.id, next, link.url);
                        if (r.ok === true) essentials.commit(r.data);
                      }}
                    />
                  </div>
                  <span className="rounded border border-[#d8dce0] bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-semibold text-[#46535e]">{kind.label}</span>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring flex min-w-0 flex-1 items-center gap-1 truncate rounded text-xs font-semibold text-[#0063a3] underline hover:text-[#004f83]"
                    aria-label={`Open ${link.label} in a new tab`}
                  >
                    <span className="truncate">{link.url}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                  </a>
                  <button
                    type="button"
                    onClick={() => essentials.commit(removeLink(essentials.data, moduleId, link.id))}
                    aria-label={`Remove link ${link.label}`}
                    title="Remove link"
                    className="focus-ring cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={submitLink} aria-label="Add link" className="flex flex-wrap items-end gap-2 rounded border border-[#e7eaef] bg-[#f8f9fa] p-2.5">
          <div className="w-52">
            <label htmlFor={`${uid}-label`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
              Label
            </label>
            <input id={`${uid}-label`} type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={formFieldClass} />
          </div>
          <div className="min-w-[220px] flex-1">
            <label htmlFor={`${uid}-url`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
              Link
            </label>
            <input id={`${uid}-url`} type="text" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/..." className={formFieldClass} />
          </div>
          <button type="submit" className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add link
          </button>
        </form>
      </section>

      <section aria-labelledby={`${uid}-contact`} className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
        <div>
          <h2 id={`${uid}-contact`} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#252a2e]">
            <UserRound className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />
            {preset.contactLabel}
          </h2>
          
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-64">
            <StakeholderSelect
              label={`${preset.contactLabel} for ${moduleTitle}`}
              value={mine.contact}
              stakeholders={stakeholders}
              onChange={(ref) => essentials.commit(setContact(essentials.data, moduleId, ref))}
              emptyLabel="Choose a key stakeholder"
            />
          </div>
          {contact?.stakeholder?.email && (
            <a
              href={`mailto:${contact.stakeholder.email}`}
              className="focus-ring flex items-center gap-1.5 rounded text-xs font-semibold text-[#0063a3] underline hover:text-[#004f83]"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              {contact.stakeholder.email}
            </a>
          )}
          {contact?.removed && <span className="text-xs text-[#6e4600]">{contact.name} has been removed from Key Stakeholders. Choose someone else.</span>}
          {stakeholders.length === 0 && (
            <p className="text-[11px] text-[#5b6770]">
              No key stakeholders yet.{' '}
              {onManageStakeholders && (
                <button type="button" onClick={onManageStakeholders} className="focus-ring cursor-pointer rounded font-semibold text-[#0063a3] underline">
                  Add one
                </button>
              )}
            </p>
          )}
        </div>
      </section>

      <TaskList
        heading={`${moduleTitle} tasks`}
        tasks={moduleTasks}
        stakeholders={stakeholders}
        moduleId={moduleId}
        onAdd={(task) => tasks.commit((prev) => ({ tasks: [...prev.tasks.filter((t) => t.id !== task.id), task] }))}
        onUpdate={(id, patch) => tasks.commit((prev) => ({ tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }))}
        onRemove={(id) => tasks.commit((prev) => ({ tasks: prev.tasks.filter((t) => t.id !== id) }))}
      />
    </div>
  );
};
