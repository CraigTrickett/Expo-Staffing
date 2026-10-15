import React from 'react';
import type { ScheduleData } from '@/types/schedule';
import { createEmptySchedule, listSpaces, normaliseSchedule, SCHEDULE_MODULE_ID } from '@/lib/schedule';
import { useModuleData } from '@/lib/useModuleData';
import { formFieldClass } from '@/components/common/StakeholderSelect';

interface RoomFieldProps {
  eventId: string;
  label: string;
  /** The room's name as printed in the export. */
  name: string;
  /** The Schedule room or joined room this keynote is in, if one was picked. */
  spaceId?: string;
  onChange: (next: { name: string; spaceId?: string }) => void;
  placeholder?: string;
}

const OTHER = '__other';

/**
 * Where a keynote happens. Picks from the rooms set up in Schedule, so the keynote
 * appears there and blocks that room. Falls back to a plain name until rooms exist,
 * or when the room is not one the venue lists.
 */
export const RoomField: React.FC<RoomFieldProps> = ({ eventId, label, name, spaceId, onChange, placeholder }) => {
  const { data } = useModuleData<ScheduleData>(eventId, SCHEDULE_MODULE_ID, createEmptySchedule, (raw) => normaliseSchedule(raw as Partial<ScheduleData>));
  const spaces = listSpaces(data);
  const known = spaceId ? spaces.find((s) => s.id === spaceId) : undefined;

  if (spaces.length === 0) {
    return (
      <div>
        <input type="text" aria-label={label} value={name} onChange={(e) => onChange({ name: e.target.value })} placeholder={placeholder} className={formFieldClass} />
        <p className="mt-0.5 text-[11px] text-[#5b6770]">Add rooms in Schedule to pick from them here.</p>
      </div>
    );
  }

  const mode = known ? known.id : name.trim() ? OTHER : '';
  return (
    <div className="space-y-1.5">
      <select
        aria-label={label}
        value={mode}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') onChange({ name: '', spaceId: undefined });
          else if (v === OTHER) onChange({ name: known ? '' : name, spaceId: undefined });
          else onChange({ name: spaces.find((s) => s.id === v)?.name ?? '', spaceId: v });
        }}
        className={formFieldClass}
      >
        <option value="">Choose a room</option>
        {spaces.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.kind === 'combination' ? ' (joined)' : ''}
          </option>
        ))}
        <option value={OTHER}>Another room (type a name)</option>
      </select>
      {mode === OTHER && (
        <input type="text" aria-label={`${label}, name`} value={name} onChange={(e) => onChange({ name: e.target.value, spaceId: undefined })} placeholder={placeholder} className={formFieldClass} />
      )}
    </div>
  );
};
