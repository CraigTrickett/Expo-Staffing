import React from 'react';
import { getTeamTone } from '@/lib/teamTone';

export const TeamChip: React.FC<{ team: string }> = ({ team }) => {
  const tone = getTeamTone(team);
  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded border px-1.5 py-0.5 text-[11px] font-semibold leading-tight"
      style={{ background: tone.bg, color: tone.fg, borderColor: tone.border }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone.accent }} aria-hidden="true" />
      <span className="truncate">{team}</span>
    </span>
  );
};
