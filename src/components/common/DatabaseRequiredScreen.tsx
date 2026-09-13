import React from 'react';
import { DatabaseZap, ExternalLink } from 'lucide-react';

/**
 * Shown instead of the entire app when Firebase isn't configured. This
 * app is designed to require a real, shared database — without one,
 * every device would silently keep its own disconnected copy of the
 * data, which is exactly the confusing failure mode this screen exists
 * to prevent rather than paper over.
 */
export const DatabaseRequiredScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#f1f3f6] flex items-center justify-center p-4 font-sans">
      <div className="max-w-lg w-full bg-white border border-[#d8dce0] rounded shadow-modus-2 p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded bg-[#fdf2f2] border border-[#f5b5b3] text-[#da3832] flex items-center justify-center mx-auto">
          <DatabaseZap className="w-7 h-7" />
        </div>
        <h1 className="text-xl font-bold text-[#252a2e] tracking-tight">
          Database Not Connected
        </h1>
        <p className="text-sm text-[#46535e] leading-relaxed">
          This app requires a connected Firebase project to run — it does not operate on
          browser-only storage. Set the <code className="text-xs bg-[#e7eaef] px-1.5 py-0.5 rounded font-mono">VITE_FIREBASE_*</code> environment
          variables for this deployment, then reload.
        </p>
        <a
          href="https://github.com/CraigTrickett/Expo-Staffing/blob/main/FIREBASE_SETUP.md"
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring inline-flex items-center space-x-1.5 text-xs font-semibold text-[#0063a3] hover:text-[#005084] transition-colors rounded"
        >
          <span>View setup instructions</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
