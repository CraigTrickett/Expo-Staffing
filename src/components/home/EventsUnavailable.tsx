import React from 'react';

/** For when the list of events could not be loaded, as distinct from there being none. */
export const EventsUnavailable: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
    <h1 className="text-lg font-bold text-[#252a2e]">Cannot reach the database</h1>
    <p className="text-xs text-[#1f2f3d]">Your events could not be loaded. Check your connection and try again.</p>
    <button type="button" onClick={onRetry} className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#005084]">
      Try again
    </button>
  </div>
);
