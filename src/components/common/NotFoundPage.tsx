import React from 'react';
import { hrefs } from '@/lib/route';

/** For an address the app does not recognise, or an area that does not exist. */
export const NotFoundPage: React.FC<{ message?: string }> = ({ message = 'That page does not exist.' }) => (
  <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
    <h1 className="text-lg font-bold text-[#252a2e]">Page not found</h1>
    <p className="text-xs text-[#1f2f3d]">{message}</p>
    <a href={hrefs.home} className="focus-ring rounded bg-[#0063a3] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#005084]">
      Go to the menu
    </a>
  </div>
);
