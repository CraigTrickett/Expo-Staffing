import React from 'react';
import type { KeyStakeholder } from '@/types';
import type { StakeholderRef } from '@/types/stakeholderRef';
import { toStakeholderRef } from '@/lib/stakeholderRef';
import { cn } from '@/lib/utils';
import { inlineFieldClass } from './InlineField';

export const formFieldClass =
  'w-full rounded border border-[#d8dce0] bg-white px-3 py-1.5 text-xs text-[#252a2e] focus:border-[#0063a3] focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,99,163,0.18)]';

interface StakeholderSelectProps {
  value: StakeholderRef | null | undefined;
  stakeholders: KeyStakeholder[];
  onChange: (next: StakeholderRef | null) => void;
  label: string;
  emptyLabel?: string;
  /** "inline" reads as text until reached, for table cells. "form" is a normal bordered field. */
  variant?: 'inline' | 'form';
  id?: string;
  className?: string;
  required?: boolean;
}

/**
 * Picks a key stakeholder. Stores an id plus a name snapshot, so a stakeholder
 * who is later removed still reads correctly instead of vanishing from the record.
 */
export const StakeholderSelect: React.FC<StakeholderSelectProps> = ({
  value,
  stakeholders,
  onChange,
  label,
  emptyLabel = 'Not set',
  variant = 'form',
  id,
  className,
  required,
}) => {
  const known = !value || stakeholders.some((s) => s.id === value.id);
  const sorted = [...stakeholders].sort((a, b) =>
    `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
  );

  return (
    <select
      id={id}
      aria-label={label}
      aria-required={required || undefined}
      value={value?.id ?? ''}
      onChange={(e) => {
        const match = stakeholders.find((s) => s.id === e.target.value);
        onChange(match ? toStakeholderRef(match) : null);
      }}
      className={cn(variant === 'inline' ? inlineFieldClass : formFieldClass, 'cursor-pointer', className)}
    >
      <option value="">{emptyLabel}</option>
      {!known && value && <option value={value.id}>{value.name} (removed)</option>}
      {sorted.map((s) => (
        <option key={s.id} value={s.id}>
          {s.firstName} {s.lastName}
          {s.team ? ` \u00b7 ${s.team}` : ''}
        </option>
      ))}
    </select>
  );
};
