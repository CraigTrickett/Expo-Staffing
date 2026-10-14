import type { KeyStakeholder, StaffMember } from '@/types';
import { generateNanoKey } from './utils';
import { storage } from './storage';

const STAKEHOLDERS_STORAGE_PREFIX = 'boothduty_stakeholders_';

export const INVOLVED_AREAS_OPTIONS = [
  'Keynote / General Session',
  'Marketing',
  'Expo Booths',
  'Badging & Registration',
  'Social Event',
  'Sponsorship',
  'Swag',
  'Session Scheduling',
  'Resources',
  'Budget',
];

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

export function getStakeholders(eventId: string, fallbackRoster?: StaffMember[]): KeyStakeholder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${STAKEHOLDERS_STORAGE_PREFIX}${eventId}`);
    let list: KeyStakeholder[] = [];
    if (raw) {
      list = JSON.parse(raw);
    } else {
      // Check stored event
      const stored = storage.getById(eventId);
      if (stored?.stakeholders && stored.stakeholders.length > 0) {
        list = stored.stakeholders;
      } else {
        list = createDefaultStakeholders(eventId, fallbackRoster || stored?.roster || []);
      }
      localStorage.setItem(`${STAKEHOLDERS_STORAGE_PREFIX}${eventId}`, JSON.stringify(list));
    }

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
  try {
    localStorage.setItem(`${STAKEHOLDERS_STORAGE_PREFIX}${eventId}`, JSON.stringify(list));
    // Also save in event document if available
    const stored = storage.getById(eventId);
    if (stored) {
      stored.stakeholders = list;
      storage.saveEvent(stored);
    }
  } catch (err) {
    console.warn('[stakeholders] Failed to save stakeholders:', err);
  }
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

function createDefaultStakeholders(eventId: string, roster: StaffMember[]): KeyStakeholder[] {
  const defaults: KeyStakeholder[] = [
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
      involvedWith: ['Keynote / General Session', 'Expo Booths', 'Session Scheduling'],
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

  return mergeRosterIntoStakeholders(eventId, defaults, roster);
}
