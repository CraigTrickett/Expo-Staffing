/**
 * Shared set-up for the tests that render the real app in jsdom.
 *
 * In a test file:
 *   // @vitest-environment jsdom
 *   vi.mock('@/lib/firebase', async (orig) => (await import('@/test/harness')).firebaseMock(await orig()));
 * then set `fb.events` and `fb.admin` before rendering.
 */
import { vi } from 'vitest';
import { screen } from '@testing-library/react';

export const fb = {
  /** The events the "database" holds. */
  events: [] as ReturnType<typeof makeEvent>[],
  /** The signed-in admin's email, or null for signed out. */
  admin: null as string | null,
  fetchError: false,
  fetchHang: false,
  deleteEventRemote: vi.fn(async (_id: string) => true),
};

export const OWNER = 'craig_trickett@trimble.com';

export function makeEvent(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title,
    startDate: '2099-11-09',
    endDate: '2099-11-11',
    location: 'Las Vegas',
    timezone: 'Europe/London',
    dailyStartTime: '09:00',
    dailyEndTime: '17:00',
    slotDurationMinutes: 60,
    staffCapacityPerSlot: 2,
    adminKey: `adm_${id}`,
    publicKey: `pub_${id}`,
    createdAt: '2099-01-01T00:00:00.000Z',
    updatedAt: '2099-01-01T00:00:00.000Z',
    ...extra,
  };
}

/** Replaces the database calls with ones that answer from `fb`. Everything else stays real. */
export function firebaseMock(actual: Record<string, unknown>) {
  return {
    ...actual,
    isFirebaseConfigured: true,
    subscribeToConnectivity: (cb: (s: string) => void) => {
      cb('connected');
      return () => {};
    },
    subscribeToAdminAuth: (cb: (email: string | null) => void) => {
      cb(fb.admin);
      return () => {};
    },
    fetchAllEvents: async () => {
      if (fb.fetchError) throw new Error('unavailable');
      if (fb.fetchHang) return new Promise(() => {});
      return fb.events.map((e) => ({ ...e }));
    },
    fetchEventByKey: async (key: string) => {
      const hit = fb.events.find((e) => e.adminKey === key || e.publicKey === key);
      if (!hit) return null;
      return { role: hit.adminKey === key ? 'admin' : 'staff', data: { config: hit, slots: [], roster: [] } };
    },
    deleteEventRemote: (id: string) => fb.deleteEventRemote(id),
  };
}

/** Browser features jsdom lacks, and a clean slate. Call from beforeEach. */
export function resetDom() {
  localStorage.clear();
  window.location.hash = '';
  fb.events = [];
  fb.admin = OWNER;
  fb.fetchError = false;
  fb.fetchHang = false;
  fb.deleteEventRemote.mockClear();
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as never;
}

/** The menu card for an area, found by its title. */
export const card = (title: string) => screen.getByRole('heading', { name: title, level: 2 }).closest('a') as HTMLAnchorElement;
