import type { EventConfig } from '@/types';

/** The event whose menu was last opened on this device, so the app can open on it next time. */
export const LAST_EVENT_KEY = 'showrunner_last_event';

const hasStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export function getLastEventId(): string | null {
  if (!hasStorage()) return null;
  try {
    return localStorage.getItem(LAST_EVENT_KEY);
  } catch {
    return null;
  }
}

export function setLastEventId(id: string): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(LAST_EVENT_KEY, id);
  } catch {
    /* a full or blocked store only means the app opens on the newest event next time */
  }
}

const stamp = (e: EventConfig) => e.updatedAt || e.createdAt || '';

/** Most recently changed first. */
export const sortEvents = (events: EventConfig[]): EventConfig[] => [...events].sort((a, b) => stamp(b).localeCompare(stamp(a)));

/** Events from the database and from this device, once each. The database copy wins. */
export function mergeEvents(remote: EventConfig[], local: EventConfig[]): EventConfig[] {
  const byId = new Map<string, EventConfig>();
  remote.forEach((e) => byId.set(e.id, e));
  local.forEach((e) => {
    if (!byId.has(e.id)) byId.set(e.id, e);
  });
  return sortEvents(Array.from(byId.values()));
}

/** Where the app opens: the event used last, if it still exists, otherwise the newest. */
export function pickDefaultEvent(events: EventConfig[], lastId: string | null): EventConfig | null {
  if (events.length === 0) return null;
  return events.find((e) => e.id === lastId) ?? sortEvents(events)[0];
}
