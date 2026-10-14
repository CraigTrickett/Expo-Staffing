/**
 * One colour per team, used wherever a team is shown (run of show table,
 * timeline strip, stakeholder list) so a team reads the same everywhere.
 * Colour is never the only signal: the team name is always printed alongside.
 */
export interface TeamTone {
  /** Soft fill for chips and timeline blocks. */
  bg: string;
  /** Text on the soft fill. */
  fg: string;
  border: string;
  /** Saturated accent: dots and the base of a timeline block. */
  accent: string;
}

const TONES: TeamTone[] = [
  { bg: '#e5f2f8', fg: '#004f83', border: '#b9dcf0', accent: '#0063a3' }, // blue
  { bg: '#e6f5ec', fg: '#005a28', border: '#b5dfc5', accent: '#00823b' }, // green
  { bg: '#fef3d6', fg: '#6e4600', border: '#f1d68c', accent: '#d99100' }, // amber
  { bg: '#e0f3f3', fg: '#0a5557', border: '#a9d9da', accent: '#12878a' }, // teal
  { bg: '#efe9f8', fg: '#472b82', border: '#d0c2ea', accent: '#7a55c2' }, // violet
  { bg: '#fbe8f0', fg: '#86184a', border: '#efbdd2', accent: '#c23a78' }, // rose
];

export const UNASSIGNED_TONE: TeamTone = {
  bg: '#f1f3f6',
  fg: '#46535e',
  border: '#d8dce0',
  accent: '#9aa5ad',
};

function hash(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getTeamTone(team?: string | null): TeamTone {
  const key = team?.trim().toLowerCase();
  if (!key) return UNASSIGNED_TONE;
  return TONES[hash(key) % TONES.length];
}

export const TEAM_TONES = TONES;
