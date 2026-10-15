import type { KeyStakeholder, StaffMember } from '@/types';
import { generateNanoKey } from './utils';
import { storage } from './storage';
import { readModuleLocal, saveModule, seedModuleLocal } from './moduleStore';

/** Where earlier versions kept stakeholders: this device only. Read once, to move them to shared storage. */
const LEGACY_STAKEHOLDERS_PREFIX = 'boothduty_stakeholders_';
export const STAKEHOLDERS_MODULE_ID = 'stakeholders';

export const INVOLVED_AREAS_OPTIONS = [
  'Keynote / General Session',
  'Marketing',
  'Expo Booths',
  'Badging & Registration',
  'Social Event',
  'Sponsorship',
  'Swag',
  'Schedule',
  'Resources',
  'Budget',
];

/** Area names that have been renamed. Stored stakeholders may still carry the old value. */
const LEGACY_AREA_NAMES: Record<string, string> = {
  'Session Scheduling': 'Schedule',
};

export function normaliseInvolvedAreas(areas: string[] = []): string[] {
  const mapped = areas.map((a) => LEGACY_AREA_NAMES[a] ?? a);
  return mapped.filter((a, i) => mapped.indexOf(a) === i);
}

export const TEAMS_OPTIONS = [
  'Executive Leadership',
  'Developer Advocacy',
  'Product Marketing',
  'Engineering',
  'Event Operations',
  'Sales Engineering',
  'Customer Success',
  'Partner Alliances',
  'Creative & Brand',
];

const asStakeholders = (raw: unknown): KeyStakeholder[] =>
  (Array.isArray(raw) ? raw : []).filter(
    (x): x is KeyStakeholder => typeof x === 'object' && x !== null && typeof (x as KeyStakeholder).id === 'string'
  );

function readLegacyStakeholders(eventId: string): KeyStakeholder[] {
  try {
    const raw = localStorage.getItem(`${LEGACY_STAKEHOLDERS_PREFIX}${eventId}`);
    if (raw) {
      const found = asStakeholders(JSON.parse(raw));
      if (found.length > 0) return found;
    }
  } catch {
    /* unreadable: treat as nothing to migrate */
  }
  return asStakeholders(storage.getById(eventId)?.stakeholders);
}

/**
 * The event's key stakeholders, shared between admins and devices through the module store: the copy
 * read here is the latest one brought in (see syncModules). A new event starts with only its booth
 * staff who gave an email, and nobody invented.
 */
export function getStakeholders(eventId: string, fallbackRoster?: StaffMember[]): KeyStakeholder[] {
  if (typeof window === 'undefined') return [];
  try {
    const shared = readModuleLocal<unknown>(eventId, STAKEHOLDERS_MODULE_ID);
    let list: KeyStakeholder[];
    if (shared) {
      list = asStakeholders(shared.data);
    } else {
      // Earlier versions kept these on this device only. Move them across, once.
      const legacy = readLegacyStakeholders(eventId);
      list = legacy.length > 0 ? legacy : mergeRosterIntoStakeholders(eventId, [], fallbackRoster || storage.getById(eventId)?.roster || []);
      // Kept so the people derived from the roster keep the same ids from one read to the next. Stamped
      // with no time (seedModuleLocal), so a shared copy that already exists is never overwritten by a read.
      if (list.length > 0) seedModuleLocal(eventId, STAKEHOLDERS_MODULE_ID, list);
    }

    list = list.map((s) => ({ ...s, involvedWith: normaliseInvolvedAreas(s.involvedWith) }));

    // Ensure any new members from roster are merged in seamlessly
    if (fallbackRoster && fallbackRoster.length > 0) {
      list = mergeRosterIntoStakeholders(eventId, list, fallbackRoster);
    }

    return list;
  } catch (err) {
    console.warn('[stakeholders] Failed to get stakeholders:', err);
    return [];
  }
}

export function saveStakeholders(eventId: string, list: KeyStakeholder[]): void {
  if (typeof window === 'undefined') return;
  // The working copy is written at once, and the shared copy follows in the background.
  void saveModule(eventId, STAKEHOLDERS_MODULE_ID, list);
}

export function addStakeholder(
  eventId: string,
  data: {
    firstName: string;
    lastName: string;
    email: string;
    team: string;
    involvedWith: string[];
    phone?: string;
    notes?: string;
  }
): KeyStakeholder {
  const current = getStakeholders(eventId);
  const newStakeholder: KeyStakeholder = {
    id: `stk_${generateNanoKey()}`,
    eventId,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.trim(),
    team: data.team.trim() || 'General',
    involvedWith: data.involvedWith.length > 0 ? data.involvedWith : ['General'],
    phone: data.phone?.trim(),
    notes: data.notes?.trim(),
    createdAt: new Date().toISOString(),
  };

  const updated = [newStakeholder, ...current];
  saveStakeholders(eventId, updated);
  return newStakeholder;
}

export function updateStakeholder(
  eventId: string,
  id: string,
  updates: Partial<Omit<KeyStakeholder, 'id' | 'eventId' | 'createdAt'>>
): KeyStakeholder | null {
  const current = getStakeholders(eventId);
  let updatedItem: KeyStakeholder | null = null;
  const updated = current.map((item) => {
    if (item.id === id) {
      updatedItem = {
        ...item,
        ...updates,
        firstName: updates.firstName !== undefined ? updates.firstName.trim() : item.firstName,
        lastName: updates.lastName !== undefined ? updates.lastName.trim() : item.lastName,
        email: updates.email !== undefined ? updates.email.trim() : item.email,
      };
      return updatedItem;
    }
    return item;
  });

  if (updatedItem) {
    saveStakeholders(eventId, updated);
  }
  return updatedItem;
}

export function deleteStakeholder(eventId: string, id: string): boolean {
  const current = getStakeholders(eventId);
  const filtered = current.filter((item) => item.id !== id);
  if (filtered.length !== current.length) {
    saveStakeholders(eventId, filtered);
    return true;
  }
  return false;
}

function mergeRosterIntoStakeholders(
  eventId: string,
  existingStakeholders: KeyStakeholder[],
  roster: StaffMember[]
): KeyStakeholder[] {
  const existingEmails = new Set(existingStakeholders.map((s) => s.email.toLowerCase()));
  const additions: KeyStakeholder[] = [];

  for (const staff of roster) {
    const emailKey = (staff.email || '').toLowerCase();
    if (emailKey && !existingEmails.has(emailKey)) {
      const parts = staff.name.trim().split(/\s+/);
      const firstName = parts[0] || staff.name;
      const lastName = parts.slice(1).join(' ') || '';

      additions.push({
        id: `stk_${staff.id}`,
        eventId,
        firstName,
        lastName,
        email: staff.email,
        team: 'Expo Operations',
        involvedWith: ['Expo Booths'],
        createdAt: new Date().toISOString(),
      });
      existingEmails.add(emailKey);
    }
  }

  if (additions.length > 0) {
    const merged = [...existingStakeholders, ...additions];
    saveStakeholders(eventId, merged);
    return merged;
  }

  return existingStakeholders;
}

/** Made-up people for trying the module out. Never added unless asked for. */
export function createSampleStakeholders(eventId: string): KeyStakeholder[] {
  return [
    {
      id: `stk_sarah_chen`,
      eventId,
      firstName: 'Sarah',
      lastName: 'Chen',
      email: 'sarah.chen@saasdisrupt.io',
      team: 'Executive Leadership',
      involvedWith: ['Keynote / General Session', 'Expo Booths', 'Marketing'],
      phone: '+1 (415) 555-0192',
      notes: 'Keynote opening address speaker; booth captain for morning peak.',
      createdAt: new Date().toISOString(),
    },
    {
      id: `stk_marcus_vance`,
      eventId,
      firstName: 'Marcus',
      lastName: 'Vance',
      email: 'marcus.vance@saasdisrupt.io',
      team: 'Developer Advocacy',
      involvedWith: ['Keynote / General Session', 'Expo Booths', 'Schedule'],
      phone: '+1 (415) 555-0143',
      notes: 'Live developer spatial AI demo in Keynote; lead booth demonstrator.',
      createdAt: new Date().toISOString(),
    },
    {
      id: `stk_elena_rostova`,
      eventId,
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'elena.rostova@saasdisrupt.io',
      team: 'Product Marketing',
      involvedWith: ['Marketing', 'Keynote / General Session', 'Social Event'],
      phone: '+1 (415) 555-0188',
      notes: 'Slide deck master owner and VIP customer liaison.',
      createdAt: new Date().toISOString(),
    },
    {
      id: `stk_dev_patel`,
      eventId,
      firstName: 'Dev',
      lastName: 'Patel',
      email: 'dev.patel@saasdisrupt.io',
      team: 'Sales Engineering',
      involvedWith: ['Expo Booths', 'Badging & Registration'],
      createdAt: new Date().toISOString(),
    },
  ];
}

/** Adds the sample people not already listed, and returns everyone. */
export function addSampleStakeholders(eventId: string): KeyStakeholder[] {
  const current = getStakeholders(eventId);
  const have = new Set(current.map((s) => s.email.toLowerCase()));
  const merged = [...current, ...createSampleStakeholders(eventId).filter((s) => !have.has(s.email.toLowerCase()))];
  saveStakeholders(eventId, merged);
  return merged;
}
