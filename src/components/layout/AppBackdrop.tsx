import React from 'react';

/** Three groups of thin rings. Fixed to the window, so the page scrolls over them. */
const RINGS: { cx: number; cy: number; radii: number[] }[] = [
  { cx: 260, cy: 250, radii: [150, 172, 194] },
  { cx: 1180, cy: 470, radii: [210, 232, 254] },
  { cx: 700, cy: 820, radii: [120, 142, 164] },
];

/**
 * The background behind every admin page. Decorative: it takes no part in the page, and assistive
 * technology skips it.
 */
export const AppBackdrop: React.FC = () => (
  <div className="app-backdrop" aria-hidden="true" data-testid="app-backdrop">
    <svg className="app-backdrop__rings" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" focusable="false">
      {RINGS.flatMap((g) => g.radii.map((r) => <circle key={`${g.cx}-${r}`} cx={g.cx} cy={g.cy} r={r} />))}
    </svg>
  </div>
);
