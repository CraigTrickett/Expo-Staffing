import type { EventConfig, StaffMember, TimeSlot } from '@/types';
import { generateDeterministicSlots, updateSlotDerivedState } from './matrix';
import { generateNanoKey } from './utils';

export interface StoredEventData {
  config: EventConfig;
  slots: TimeSlot[];
  roster: StaffMember[];
}

const STORAGE_KEY = 'boothduty_events_v1';
const IDENTITY_STORAGE_PREFIX = 'boothduty_identity_';

export const DEMO_ADMIN_KEY = 'adm_demo_saas2026';
export const DEMO_PUBLIC_KEY = 'pub_demo_saas2026';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Creates the polished demo event ("SaaS Disrupt Expo 2026", 2 days, 09:00-17:00, 2-staff capacity, 6-person roster)
 */
export function createDemoEvent(): StoredEventData {
  const today = new Date();
  // Upcoming 2-day conference dates
  const d1 = new Date(today);
  d1.setDate(today.getDate() + 7);
  const d2 = new Date(d1);
  d2.setDate(d1.getDate() + 1);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const startDate = formatDateStr(d1);
  const endDate = formatDateStr(d2);

  const eventId = 'evt_saas_disrupt_2026';

  const config: EventConfig = {
    id: eventId,
    title: 'SaaS Disrupt Expo 2026',
    description: 'Premier B2B Cloud & AI Expo Staffing Schedule. Claim your shifts and sync directly to Google / Apple Calendar.',
    location: 'Moscone West Convention Center, San Francisco, CA (Booth #742)',
    timezone: 'America/Los_Angeles',
    startDate,
    endDate,
    dailyStartTime: '09:00',
    dailyEndTime: '17:00',
    slotDurationMinutes: 60,
    staffCapacityPerSlot: 2,
    adminKey: DEMO_ADMIN_KEY,
    publicKey: DEMO_PUBLIC_KEY,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const roster: StaffMember[] = [
    {
      id: 'staff_sarah_c',
      eventId,
      name: 'Sarah Chen',
      email: 'sarah.chen@saasdisrupt.io',
      totalBookedHours: 0,
      isConfirmed: true,
    },
    {
      id: 'staff_marcus_v',
      eventId,
      name: 'Marcus Vance',
      email: 'marcus.vance@saasdisrupt.io',
      totalBookedHours: 0,
      isConfirmed: true,
    },
    {
      id: 'staff_elena_r',
      eventId,
      name: 'Elena Rostova',
      email: 'elena.rostova@saasdisrupt.io',
      totalBookedHours: 0,
      isConfirmed: true,
    },
    {
      id: 'staff_dev_p',
      eventId,
      name: 'Dev Patel',
      email: 'dev.patel@saasdisrupt.io',
      totalBookedHours: 0,
      isConfirmed: true,
    },
    {
      id: 'staff_zoe_w',
      eventId,
      name: 'Zoe Washington',
      email: 'zoe.washington@saasdisrupt.io',
      totalBookedHours: 0,
      isConfirmed: false,
    },
    {
      id: 'staff_liam_o',
      eventId,
      name: "Liam O'Connor",
      email: 'liam.oconnor@saasdisrupt.io',
      totalBookedHours: 0,
      isConfirmed: false,
    },
  ];

  let rawSlots = generateDeterministicSlots(config);

  // Seed realistic bookings for day 1 and day 2 to create initial progress:
  // Sarah Chen (2 shifts = 2h), Marcus Vance (3 shifts = 3h), Elena Rostova (2 shifts = 2h), Dev Patel (1 shift = 1h)
  // Zoe Washington and Liam O'Connor have 0 hours (uncommitted staff alert demonstrable)
  const initialBookings: { slotIndex: number; staff: StaffMember }[] = [
    // Day 1 09:00 - 10:00 (slot 0)
    { slotIndex: 0, staff: roster[0] }, // Sarah Chen
    { slotIndex: 0, staff: roster[1] }, // Marcus Vance (Fully booked slot!)
    // Day 1 10:00 - 11:00 (slot 1)
    { slotIndex: 1, staff: roster[2] }, // Elena Rostova
    // Day 1 11:00 - 12:00 (slot 2)
    { slotIndex: 2, staff: roster[1] }, // Marcus Vance
    // Day 1 13:00 - 14:00 (slot 4)
    { slotIndex: 4, staff: roster[3] }, // Dev Patel
    // Day 2 09:00 - 10:00 (slot 8)
    { slotIndex: 8, staff: roster[0] }, // Sarah Chen
    { slotIndex: 8, staff: roster[2] }, // Elena Rostova (Fully booked slot!)
    // Day 2 10:00 - 11:00 (slot 9)
    { slotIndex: 9, staff: roster[1] }, // Marcus Vance
  ];

  for (const item of initialBookings) {
    if (rawSlots[item.slotIndex]) {
      const slot = rawSlots[item.slotIndex];
      slot.bookings.push({
        id: `bk_${generateNanoKey()}`,
        slotId: slot.id,
        staffId: item.staff.id,
        staffName: item.staff.name,
        staffEmail: item.staff.email,
        bookedAt: new Date().toISOString(),
      });
      item.staff.totalBookedHours += config.slotDurationMinutes / 60;
    }
  }

  // Update derived slot states
  rawSlots = rawSlots.map(updateSlotDerivedState);

  return {
    config,
    slots: rawSlots,
    roster,
  };
}

export const storage = {
  getAll(): Record<string, StoredEventData> {
    if (!isBrowser()) return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  saveEvent(data: StoredEventData): void {
    if (!isBrowser()) return;
    try {
      const all = this.getAll();
      all[data.config.id] = data;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (err) {
      console.error('[storage] Failed to save event:', err);
    }
  },

  getById(eventId: string): StoredEventData | null {
    const all = this.getAll();
    return all[eventId] || null;
  },

  /**
   * Lists every event this browser has created or loaded, most recently
   * updated first. This is the basis of the "My Events" recovery panel —
   * it only ever sees events this specific browser has touched, since
   * there is no account system to recover across devices.
   */
  listLocalEvents(): EventConfig[] {
    const all: Record<string, StoredEventData> = this.getAll();
    return Object.values(all)
      .map((evt) => evt.config)
      .filter((config): config is EventConfig => Boolean(config))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  },

  getByAdminKey(adminKey: string): StoredEventData | null {
    const all: Record<string, StoredEventData> = this.getAll();
    const list: StoredEventData[] = Object.values(all);
    for (const evt of list) {
      if (evt?.config?.adminKey === adminKey) {
        return evt;
      }
    }
    return null;
  },

  getByPublicKey(publicKey: string): StoredEventData | null {
    const all: Record<string, StoredEventData> = this.getAll();
    const list: StoredEventData[] = Object.values(all);
    for (const evt of list) {
      if (evt?.config?.publicKey === publicKey) {
        return evt;
      }
    }
    return null;
  },

  getByKey(key: string): { data: StoredEventData; role: 'admin' | 'staff' } | null {
    const trimmed = key.trim();
    const all: Record<string, StoredEventData> = this.getAll();
    const list: StoredEventData[] = Object.values(all);
    for (const evt of list) {
      if (evt?.config?.adminKey === trimmed) {
        return { data: evt, role: 'admin' };
      }
      if (evt?.config?.publicKey === trimmed) {
        return { data: evt, role: 'staff' };
      }
    }
    return null;
  },

  deleteEvent(eventId: string): void {
    if (!isBrowser()) return;
    try {
      const all: Record<string, StoredEventData> = this.getAll();
      delete all[eventId];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch (err) {
      console.error('[storage] Failed to delete event:', err);
    }
  },

  initOrSeed(): StoredEventData {
    if (!isBrowser()) {
      return createDemoEvent();
    }

    const all: Record<string, StoredEventData> = this.getAll();
    const list: StoredEventData[] = Object.values(all);
    if (list.length === 0) {
      const demo = createDemoEvent();
      this.saveEvent(demo);
      return demo;
    }

    // Return the first stored event or demo
    const firstEvent = list[0];
    return firstEvent || createDemoEvent();
  },

  resetToDemo(): StoredEventData {
    if (isBrowser()) {
      localStorage.removeItem(STORAGE_KEY);
    }
    const demo = createDemoEvent();
    this.saveEvent(demo);
    return demo;
  },

  getPersistedStaffId(eventId: string): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(`${IDENTITY_STORAGE_PREFIX}${eventId}`);
  },

  setPersistedStaffId(eventId: string, staffId: string | null): void {
    if (!isBrowser()) return;
    if (staffId) {
      localStorage.setItem(`${IDENTITY_STORAGE_PREFIX}${eventId}`, staffId);
    } else {
      localStorage.removeItem(`${IDENTITY_STORAGE_PREFIX}${eventId}`);
    }
  },
};
