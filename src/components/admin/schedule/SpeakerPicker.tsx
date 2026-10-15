import React, { useId } from 'react';
import { X } from 'lucide-react';
import type { KeyStakeholder } from '@/types';
import type { StakeholderRef } from '@/types/stakeholderRef';
import { describeStakeholderRef, toStakeholderRef } from '@/lib/stakeholderRef';
import { formFieldClass } from '@/components/common/StakeholderSelect';

interface SpeakerPickerProps {
  speakers: StakeholderRef[];
  stakeholders: KeyStakeholder[];
  onChange: (next: StakeholderRef[]) => void;
  label: string;
  onManageStakeholders?: () => void;
}

/** Speakers are key stakeholders. Each is stored as an id plus a name snapshot, so a removed stakeholder still reads correctly. */
export const SpeakerPicker: React.FC<SpeakerPickerProps> = ({ speakers, stakeholders, onChange, label, onManageStakeholders }) => {
  const uid = useId();
  const available = stakeholders
    .filter((s) => !speakers.some((x) => x.id === s.id))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  return (
    <div>
      {speakers.length > 0 && (
        <ul className="mb-1.5 flex flex-wrap gap-1.5" aria-label={`${label}: current speakers`}>
          {speakers.map((sp) => {
            const removed = !stakeholders.some((s) => s.id === sp.id);
            return (
              <li key={sp.id} className="inline-flex items-center gap-1 rounded border border-[#b9dcf0] bg-[#e5f2f8] py-0.5 pl-2 pr-1 text-[11px] font-semibold text-[#004f83]">
                <span>{describeStakeholderRef(sp, stakeholders)}</span>
                <button
                  type="button"
                  onClick={() => onChange(speakers.filter((x) => x.id !== sp.id))}
                  aria-label={`Remove ${sp.name}${removed ? ' (removed stakeholder)' : ''} as a speaker`}
                  className="focus-ring cursor-pointer rounded p-0.5 hover:bg-[#b9dcf0]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <label htmlFor={`${uid}-add`} className="sr-only">
        Add a speaker to {label}
      </label>
      <select
        id={`${uid}-add`}
        value=""
        onChange={(e) => {
          const match = stakeholders.find((s) => s.id === e.target.value);
          if (match) onChange([...speakers, toStakeholderRef(match)]);
        }}
        className={`${formFieldClass} cursor-pointer`}
      >
        <option value="">{available.length === 0 ? 'No more key stakeholders to add' : 'Add a speaker\u2026'}</option>
        {available.map((s) => (
          <option key={s.id} value={s.id}>
            {s.firstName} {s.lastName}
            {s.team ? ` \u00b7 ${s.team}` : ''}
          </option>
        ))}
      </select>
      {stakeholders.length === 0 && onManageStakeholders && (
        <p className="mt-0.5 text-[11px] text-[#5b6770]">
          Speakers are key stakeholders.{' '}
          <button type="button" onClick={onManageStakeholders} className="focus-ring cursor-pointer rounded font-semibold text-[#0063a3] underline">
            Add one
          </button>
        </p>
      )}
    </div>
  );
};
