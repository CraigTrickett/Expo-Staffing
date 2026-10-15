import type { CategoryLevel, Level } from '@/lib/budget';

export interface LevelStyle {
  label: string;
  text: string;
  bg: string;
  border: string;
  bar: string;
}

const GREY: LevelStyle = { label: 'No budget yet', text: '#46535e', bg: '#f1f3f6', border: '#d8dce0', bar: '#9aa5ad' };
const OK: LevelStyle = { label: 'On track', text: '#005a28', bg: '#e6f5ec', border: '#b5dfc5', bar: '#00823b' };
const AMBER: LevelStyle = { label: 'Close', text: '#6e4600', bg: '#fef3d6', border: '#f1d68c', bar: '#d99100' };
const RED: LevelStyle = { label: 'Over budget', text: '#9e1b16', bg: '#fdecec', border: '#f2b8b5', bar: '#da3832' };

/** Whole budget: over is red. */
export const TOTAL_STYLE: Record<Level, LevelStyle> = {
  none: GREY,
  ok: OK,
  watch: { ...AMBER, label: 'Close to budget' },
  over: RED,
};

/** One category: over is amber, because the budget as a whole may still be fine. */
export const CATEGORY_STYLE: Record<CategoryLevel, LevelStyle> = {
  none: { ...GREY, label: '' },
  ok: { ...OK, label: 'On track' },
  watch: { ...AMBER, label: 'Close' },
  over: { ...AMBER, label: 'Over' },
  unallocated: { ...AMBER, label: 'No amount' },
};
