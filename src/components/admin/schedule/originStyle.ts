import type { SessionOrigin } from '@/types/schedule';

export interface OriginStyle {
  label: string;
  /** Card fill, border and text. */
  bg: string;
  border: string;
  text: string;
  /** A stronger tone for chips and the selected state. */
  chipBg: string;
}

/**
 * Internal sessions are blue and external ones orange, as on the planning board. The label is always
 * printed as well, so the difference never rests on colour alone.
 */
export const ORIGIN_STYLE: Record<SessionOrigin, OriginStyle> = {
  internal: { label: 'Internal', bg: '#e5f2f8', border: '#b9dcf0', text: '#004f83', chipBg: '#d3e9f5' },
  external: { label: 'External', bg: '#fdeede', border: '#f0bf8f', text: '#7a3300', chipBg: '#fbdcb9' },
};

/** Sessions fixed in place: dashed gold, like the FIXED cards on the board. */
export const FIXED_STYLE = { bg: '#fff6cf', border: '#b8860b', text: '#4d3800' } as const;

/** Breaks and all-attendee events across the whole day. */
export const BLOCK_STYLE = {
  break: { bg: '#efefef', text: '#46535e', label: 'Break' },
  event: { bg: '#d9d9d9', text: '#252a2e', label: 'Event' },
} as const;
