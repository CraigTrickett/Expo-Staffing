import React from 'react';
import { Loader2 } from 'lucide-react';

/** Shown while a page's code or data is on its way. */
export const PageSpinner: React.FC = () => (
  <div className="flex items-center justify-center py-24" role="status">
    <Loader2 className="h-6 w-6 animate-spin text-[#0063a3]" aria-hidden="true" />
    <span className="sr-only">Loading</span>
  </div>
);
