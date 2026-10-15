import type { OtherData, OtherLink, OtherNote } from '@/types/other';
import { isLinkFailure, parseLink } from './links';

export const OTHER_DATA_MODULE_ID = 'other';

export const createEmptyOther = (): OtherData => ({ notes: [], links: [] });

export function normaliseOther(raw: Partial<OtherData> | null | undefined): OtherData {
  return {
    notes: Array.isArray(raw?.notes) ? raw!.notes! : [],
    links: Array.isArray(raw?.links) ? raw!.links! : [],
  };
}

export function createNote(input: { title: string; body: string; moduleId?: string }, now: Date = new Date()): OtherNote {
  return {
    id: `note_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim(),
    body: input.body.trim(),
    moduleId: input.moduleId || undefined,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export type NewLinkResult = { ok: true; link: OtherLink } | { ok: false; error: string };

export function createOtherLink(input: { title: string; url: string; moduleId?: string }, now: Date = new Date()): NewLinkResult {
  const parsed = parseLink(input.url);
  if (isLinkFailure(parsed)) return parsed;
  return {
    ok: true,
    link: {
      id: `olink_${now.getTime()}_${Math.random().toString(36).slice(2, 6)}`,
      title: input.title.trim() || parsed.url,
      url: parsed.url,
      moduleId: input.moduleId || undefined,
      createdAt: now.toISOString(),
    },
  };
}

/** Newest first. */
export const newestFirst = <T extends { createdAt: string }>(items: T[]): T[] =>
  [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
