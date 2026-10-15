import React from 'react';
import type { SaveState } from '@/lib/useModuleData';

const TEXT: Record<SaveState, { text: string; tone: string }> = {
  checking: { text: '', tone: '#5b6770' },
  saving: { text: 'Saving\u2026', tone: '#5b6770' },
  synced: { text: 'Saved and shared', tone: '#005a28' },
  local_only: { text: 'Saved on this device. Shared storage is not set up.', tone: '#46535e' },
  not_synced: { text: 'Saved on this device only. Sign in as admin to share it.', tone: '#6e4600' },
};

/** Says where a module's data has been saved. Visible at every screen size: a "not shared" warning must not be hidden on a phone. */
export const SaveStatus: React.FC<{ state: SaveState; className?: string }> = ({ state, className = '' }) => (
  <p role="status" className={`min-h-4 text-[11px] ${className}`} style={{ color: TEXT[state].tone }}>
    {TEXT[state].text}
  </p>
);
