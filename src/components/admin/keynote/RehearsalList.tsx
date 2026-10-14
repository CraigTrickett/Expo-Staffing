import React, { useEffect, useRef, useState } from 'react';
import { Check, Pencil, Plus, Video } from 'lucide-react';
import type { RehearsalItem } from '@/types';
import { toast } from '@/components/common/Toast';
import { formatDate } from '@/lib/utils';

interface RehearsalListProps {
  rehearsals: RehearsalItem[];
  /** Used when a new rehearsal is added without a date. */
  fallbackDate: string;
  onChange: (next: RehearsalItem[]) => void;
}

const fieldClass =
  'w-full rounded border border-[#d8dce0] bg-white px-2.5 py-1.5 text-xs text-[#252a2e] focus:border-[#0063a3] focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,99,163,0.18)]';

interface Draft {
  title: string;
  targetDate: string;
  time: string;
  locationOrUrl: string;
  notes: string;
}

const emptyDraft = (date: string): Draft => ({
  title: '',
  targetDate: date,
  time: '14:00',
  locationOrUrl: 'Virtual / Google Meet',
  notes: '',
});

export const RehearsalList: React.FC<RehearsalListProps> = ({ rehearsals, fallbackDate, onChange }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const add = (draft: Draft) => {
    const item: RehearsalItem = {
      id: `reh_${Date.now()}`,
      title: draft.title.trim(),
      targetDate: draft.targetDate || fallbackDate,
      time: draft.time,
      locationOrUrl: draft.locationOrUrl.trim(),
      isCompleted: false,
      notes: draft.notes.trim(),
    };
    onChange([...rehearsals, item]);
    setIsAdding(false);
    toast.success('Rehearsal scheduled.', 'Rehearsal Added');
  };

  const save = (id: string, draft: Draft) => {
    onChange(
      rehearsals.map((r) =>
        r.id === id
          ? {
              ...r,
              title: draft.title.trim(),
              targetDate: draft.targetDate || r.targetDate,
              time: draft.time,
              locationOrUrl: draft.locationOrUrl.trim(),
              notes: draft.notes.trim(),
            }
          : r
      )
    );
    setEditingId(null);
    setAnnouncement(`Saved changes to ${draft.title.trim()}.`);
    toast.success('Rehearsal updated.', 'Changes Saved');
  };

  const toggle = (id: string) =>
    onChange(rehearsals.map((r) => (r.id === id ? { ...r, isCompleted: !r.isCompleted } : r)));

  return (
    <div className="space-y-3 rounded border border-[#d8dce0] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />
            <span className="text-xs font-bold text-[#252a2e]">
              Rehearsal Schedule (2&ndash;3 Rehearsals ~1 Month Before Event)
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#5b6770]">
            Track dry runs, full deck walkthroughs, and technical on-site rehearsals. Use the pencil to change any
            detail.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setIsAdding(true);
          }}
          className="focus-ring flex cursor-pointer items-center gap-1 rounded border border-[#b9dcf0] px-2.5 py-1 text-xs font-semibold text-[#0063a3] hover:bg-[#e5f2f8]"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          <span>Add Rehearsal</span>
        </button>
      </div>

      {isAdding && (
        <RehearsalForm
          heading="New rehearsal"
          initial={emptyDraft(fallbackDate)}
          submitLabel="Save Rehearsal"
          onSubmit={add}
          onCancel={() => setIsAdding(false)}
        />
      )}

      <ul className="space-y-2">
        {rehearsals.map((r) =>
          editingId === r.id ? (
            <li key={r.id}>
              <RehearsalForm
                heading="Edit rehearsal"
                initial={{
                  title: r.title,
                  targetDate: r.targetDate,
                  time: r.time,
                  locationOrUrl: r.locationOrUrl,
                  notes: r.notes ?? '',
                }}
                submitLabel="Save Changes"
                onSubmit={(draft) => save(r.id, draft)}
                onCancel={() => setEditingId(null)}
              />
            </li>
          ) : (
            <li
              key={r.id}
              className={`flex items-center justify-between gap-3 rounded border p-3 transition-colors ${
                r.isCompleted ? 'border-[#b5dfc5] bg-[#e6f5ec]' : 'border-[#e7eaef] bg-[#fafbfc]'
              }`}
            >
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={r.isCompleted}
                  aria-label={`Mark ${r.title} as ${r.isCompleted ? 'pending' : 'completed'}`}
                  onClick={() => toggle(r.id)}
                  className={`focus-ring mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors ${
                    r.isCompleted
                      ? 'border-[#00823b] bg-[#00823b] text-white'
                      : 'border-[#b8c0c7] bg-white hover:border-[#0063a3]'
                  }`}
                >
                  {r.isCompleted && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                </button>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs font-bold text-[#252a2e]">
                    <span>{r.title}</span>
                    <span className="text-[11px] font-normal text-[#46535e]">
                      {formatDate(r.targetDate) || r.targetDate} at {r.time}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[#46535e]">
                    Location: {r.locationOrUrl || 'Not set'}
                    {r.notes ? ` \u2022 ${r.notes}` : ''}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                    r.isCompleted ? 'bg-white text-[#005a28]' : 'bg-[#f1f3f6] text-[#46535e]'
                  }`}
                >
                  {r.isCompleted ? 'Completed' : 'Pending'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(r.id);
                  }}
                  aria-label={`Edit ${r.title}`}
                  title="Edit rehearsal"
                  className="focus-ring cursor-pointer rounded p-1.5 text-[#5b6770] transition-colors hover:bg-[#e5f2f8] hover:text-[#0063a3]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          )
        )}
      </ul>

      {rehearsals.length === 0 && !isAdding && (
        <p className="rounded border border-dashed border-[#c5ccd3] px-3 py-6 text-center text-[11px] text-[#5b6770]">
          No rehearsals scheduled. Add one to start tracking dry runs.
        </p>
      )}

      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
};

const RehearsalForm: React.FC<{
  heading: string;
  initial: Draft;
  submitLabel: string;
  onSubmit: (draft: Draft) => void;
  onCancel: () => void;
}> = ({ heading, initial, submitLabel, onSubmit, onCancel }) => {
  const [draft, setDraft] = useState<Draft>(initial);
  const titleRef = useRef<HTMLInputElement>(null);
  const uid = useRef(`reh-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    titleRef.current?.focus();
    titleRef.current?.select();
  }, []);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.title.trim()) {
      toast.error('Give the rehearsal a title.', 'Missing Field');
      titleRef.current?.focus();
      return;
    }
    onSubmit(draft);
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
      aria-label={heading}
      className="space-y-2.5 rounded border border-[#b9dcf0] bg-[#f8f9fa] p-3 animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
    >
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor={`${uid}-title`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Rehearsal Title
          </label>
          <input
            id={`${uid}-title`}
            ref={titleRef}
            type="text"
            required
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Rehearsal 4: Final Cue Check"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-date`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Target Date
          </label>
          <input
            id={`${uid}-date`}
            type="date"
            value={draft.targetDate}
            onChange={(e) => set('targetDate', e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-time`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Time
          </label>
          <input
            id={`${uid}-time`}
            type="time"
            value={draft.time}
            onChange={(e) => set('time', e.target.value)}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-loc`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Location / Link
          </label>
          <input
            id={`${uid}-loc`}
            type="text"
            value={draft.locationOrUrl}
            onChange={(e) => set('locationOrUrl', e.target.value)}
            placeholder="Studio A / Google Meet"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-notes`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Notes
          </label>
          <input
            id={`${uid}-notes`}
            type="text"
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="What this run needs to cover"
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring cursor-pointer rounded border border-[#d8dce0] bg-white px-2.5 py-1 text-xs text-[#46535e] hover:border-[#0063a3]"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3 py-1 text-xs font-semibold text-white hover:bg-[#005084]"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
};
