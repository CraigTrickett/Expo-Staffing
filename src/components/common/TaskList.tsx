import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ListChecks, Plus, Trash2 } from 'lucide-react';
import type { KeyStakeholder } from '@/types';
import type { Task } from '@/types/tasks';
import type { StakeholderRef } from '@/types/stakeholderRef';
import { createTask, isOverdue, sortTasks, taskStats, toggleTask } from '@/lib/tasks';
import { formatDate } from '@/lib/utils';
import { InlineText, inlineFieldClass } from './InlineField';
import { StakeholderSelect, formFieldClass } from './StakeholderSelect';
import { toast } from './Toast';

export interface TaskModuleOption {
  id: string;
  title: string;
}

interface TaskListProps {
  tasks: Task[];
  stakeholders: KeyStakeholder[];
  onAdd: (task: Task) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onRemove: (id: string) => void;
  /** Tag given to every new task. Used when the list is already scoped to one module. */
  moduleId?: string;
  /** When present, new and existing tasks can be tagged to any of these areas. */
  moduleOptions?: TaskModuleOption[];
  /** Adds a "raised by" field. Used where tasks become the Open Items of a document. */
  showRaisedBy?: boolean;
  heading?: string;
  description?: string;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  stakeholders,
  onAdd,
  onUpdate,
  onRemove,
  moduleId,
  moduleOptions,
  showRaisedBy,
  heading = 'Tasks',
  description,
}) => {
  const uid = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState<StakeholderRef | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [raisedBy, setRaisedBy] = useState('');
  const [tag, setTag] = useState(moduleId ?? moduleOptions?.[0]?.id ?? '');
  const [removed, setRemoved] = useState<Task | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const sorted = useMemo(() => sortTasks(tasks), [tasks]);
  const stats = taskStats(tasks);

  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(t);
  }, [removed]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Describe the task.', 'Missing field');
      titleRef.current?.focus();
      return;
    }
    onAdd(createTask({ title, owner, dueDate, raisedBy: showRaisedBy ? raisedBy : undefined, moduleId: moduleId ?? (tag || undefined) }));
    setAnnouncement(`Added task ${title.trim()}.`);
    setTitle('');
    setDueDate('');
    setRaisedBy('');
    titleRef.current?.focus();
  };

  const remove = (task: Task) => {
    onRemove(task.id);
    setRemoved(task);
    setAnnouncement(`Removed task ${task.title}. Undo is available.`);
  };

  return (
    <section aria-labelledby={`${uid}-heading`} className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
      <div>
        <h2 id={`${uid}-heading`} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#252a2e]">
          <ListChecks className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />
          {heading}
          {tasks.length > 0 && (
            <span className="ml-1 rounded bg-[#f1f3f6] px-1.5 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-[#46535e]">
              {stats.open} open{stats.overdue > 0 && <span className="text-[#9e1b16]">, {stats.overdue} overdue</span>}
            </span>
          )}
        </h2>
        {description && <p className="mt-0.5 text-[11px] text-[#5b6770]">{description}</p>}
      </div>

      <form onSubmit={submit} aria-label={`Add to ${heading.toLowerCase()}`} className="flex flex-wrap items-end gap-2 rounded border border-[#e7eaef] bg-[#f8f9fa] p-2.5">
        <div className="min-w-[200px] flex-1">
          <label htmlFor={`${uid}-title`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            New task
          </label>
          <input
            id={`${uid}-title`}
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className={formFieldClass}
          />
        </div>
        <div className="w-44">
          <label htmlFor={`${uid}-owner`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Owner
          </label>
          <StakeholderSelect id={`${uid}-owner`} label="Owner" value={owner} stakeholders={stakeholders} onChange={setOwner} emptyLabel="No owner" />
        </div>
        <div className="w-36">
          <label htmlFor={`${uid}-due`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Due
          </label>
          <input id={`${uid}-due`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={formFieldClass} />
        </div>
        {showRaisedBy && (
          <div className="w-44">
            <label htmlFor={`${uid}-raised`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
              Raised by
            </label>
            <input id={`${uid}-raised`} type="text" value={raisedBy} onChange={(e) => setRaisedBy(e.target.value)} placeholder="Name, date" className={formFieldClass} />
          </div>
        )}
        {moduleOptions && !moduleId && (
          <div className="w-44">
            <label htmlFor={`${uid}-tag`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
              Area
            </label>
            <select id={`${uid}-tag`} value={tag} onChange={(e) => setTag(e.target.value)} className={formFieldClass}>
              {moduleOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add task
        </button>
      </form>

      {sorted.length === 0 ? (
        <p className="rounded border border-dashed border-[#c5ccd3] px-3 py-6 text-center text-[11px] text-[#5b6770]">No tasks yet.</p>
      ) : (
        <ul className="divide-y divide-[#e7eaef] rounded border border-[#e7eaef]">
          {sorted.map((task) => {
            const overdue = isOverdue(task);
            const done = task.status === 'done';
            return (
              <li key={task.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 bg-white px-3 py-2">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${done ? 'Reopen' : 'Complete'} ${task.title}`}
                  onClick={() => onUpdate(task.id, toggleTask(task))}
                  className={`focus-ring mt-1 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
                    done ? 'border-[#00823b] bg-[#00823b] text-white' : 'border-[#b8c0c7] bg-white hover:border-[#0063a3]'
                  }`}
                >
                  {done && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>

                <div className="min-w-[180px] flex-1">
                  <InlineText
                    value={task.title}
                    label={`Title of task ${task.title}`}
                    required
                    requiredMessage="A task needs a title."
                    semibold
                    onCommit={(next) => onUpdate(task.id, { title: next })}
                    className={done ? 'text-[#5b6770] line-through' : ''}
                  />
                  <InlineText
                    multiline
                    value={task.notes ?? ''}
                    label={`Notes for task ${task.title}`}
                    placeholder="Add notes"
                    onCommit={(next) => onUpdate(task.id, { notes: next || undefined })}
                    className="text-[11px]"
                  />
                  {showRaisedBy && (
                    <InlineText
                      value={task.raisedBy ?? ''}
                      label={`Raised by for task ${task.title}`}
                      placeholder="Raised by (name, date)"
                      onCommit={(next) => onUpdate(task.id, { raisedBy: next || undefined })}
                      className="text-[11px]"
                    />
                  )}
                </div>

                <div className="w-44">
                  <StakeholderSelect
                    variant="inline"
                    label={`Owner of task ${task.title}`}
                    emptyLabel="No owner"
                    value={task.owner}
                    stakeholders={stakeholders}
                    onChange={(ref) => onUpdate(task.id, { owner: ref ?? undefined })}
                  />
                </div>

                <div className="w-40">
                  <input
                    type="date"
                    aria-label={`Due date of task ${task.title}`}
                    value={task.dueDate ?? ''}
                    onChange={(e) => onUpdate(task.id, { dueDate: e.target.value || undefined })}
                    className={`${inlineFieldClass} ${overdue ? 'font-semibold text-[#9e1b16]' : ''}`}
                    title={task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                  />
                  {overdue && <span className="px-2 text-[11px] font-semibold text-[#9e1b16]">Overdue</span>}
                </div>

                {moduleOptions && (
                  <div className="w-40">
                    <select
                      aria-label={`Area of task ${task.title}`}
                      value={task.moduleId ?? ''}
                      onChange={(e) => onUpdate(task.id, { moduleId: e.target.value || undefined })}
                      className={`${inlineFieldClass} cursor-pointer`}
                    >
                      <option value="">No area</option>
                      {moduleOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => remove(task)}
                  aria-label={`Remove task ${task.title}`}
                  title="Remove task"
                  className="focus-ring mt-0.5 cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {removed && (
        <div role="status" className="flex items-center justify-between gap-3 rounded border border-[#d8dce0] bg-[#f8f9fa] px-3 py-2 text-xs text-[#252a2e] animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none">
          <span className="min-w-0 truncate">
            Removed <span className="font-semibold">&ldquo;{removed.title}&rdquo;</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onAdd(removed);
              setAnnouncement(`Restored task ${removed.title}.`);
              setRemoved(null);
            }}
            className="focus-ring shrink-0 cursor-pointer rounded px-2 py-0.5 font-semibold text-[#0063a3] hover:bg-[#e5f2f8]"
          >
            Undo
          </button>
        </div>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
};
