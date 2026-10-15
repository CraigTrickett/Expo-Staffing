import React, { useState } from 'react';

/** For someone who is signed in but whose admin access could not be checked, usually a connection problem. */
export const AccessCheckFailed: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const [trying, setTrying] = useState(false);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <h1 className="text-lg font-bold text-[#252a2e]">Could not check your access</h1>
      <p className="text-xs text-[#1f2f3d]">You are signed in, but your access could not be confirmed. Check your connection and try again.</p>
      <button
        type="button"
        disabled={trying}
        onClick={() => {
          setTrying(true);
          onRetry();
          setTimeout(() => setTrying(false), 1500);
        }}
        className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#005084] disabled:cursor-default disabled:opacity-60"
      >
        Try again
      </button>
    </div>
  );
};
