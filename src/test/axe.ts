import axe from 'axe-core';

export interface Violation {
  id: string;
  impact: string;
  help: string;
  count: number;
  example: string;
}

/**
 * Runs axe-core over what is on screen. Colour contrast and landmark "region" rules are off: jsdom has no
 * layout to measure contrast from, and the region rule judges a whole page rather than the part under test.
 * (Contrast of the colours the app uses is checked separately, by calculation.)
 */
export async function runAxe(root: Element = document.body): Promise<Violation[]> {
  const result = await axe.run(root, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    resultTypes: ['violations'],
  });
  return result.violations.map((v) => ({
    id: v.id,
    impact: v.impact ?? 'unknown',
    help: v.help,
    count: v.nodes.length,
    example: v.nodes[0].html.replace(/\s+/g, ' ').slice(0, 140),
  }));
}

export const describeViolations = (v: Violation[]) => v.map((x) => `[${x.impact}] ${x.id}: ${x.help} (${x.count}) e.g. ${x.example}`).join('\n');
