// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calls, firestoreFake, mode, resetFake, store, writes } from '@/test/fakeFirestore';

vi.mock('firebase/app', () => ({ initializeApp: () => ({}) }));
const callable = { fail: false, calls: 0 };
vi.mock('firebase/functions', () => ({
  getFunctions: () => ({}),
  httpsCallable: () => async () => {
    callable.calls += 1;
    if (callable.fail) throw new Error('functions unavailable');
    return { data: {} };
  },
}));
vi.mock('firebase/auth', () => ({
  getAuth: () => ({}),
  signInWithEmailAndPassword: async () => ({}),
  signOut: async () => {},
  onAuthStateChanged: () => () => {},
  sendPasswordResetEmail: async () => {},
}));
vi.mock('firebase/firestore', async () => (await import('@/test/fakeFirestore')).firestoreFake);

const RULES = fs.readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf8');

const config = (over: Record<string, unknown> = {}) => ({
  id: 'e1', title: 'Summit', adminKey: 'adm1', publicKey: 'pub1', staffCapacityPerSlot: 2, updatedAt: '2026-01-01T00:00:00.000Z', ...over,
});
const slot = (id: string, bookings: unknown[] = []) => ({ id, date: '2026-11-09', startTime: '09:00', endTime: '10:00', capacity: 2, isFull: false, bookings });
const person = (id: string) => ({ id, name: id, email: `${id}@x.com`, totalBookedHours: 0 });
const booking = (id: string, staffId: string) => ({ id, slotId: 's1', staffId, staffName: staffId, staffEmail: '', bookedAt: '2026-01-01T00:00:00.000Z' });

/** The event as it sits in the database, with its public link. */
const seed = () => {
  store.set('boothEvents/e1', { adminKey: 'adm1', publicKey: 'pub1', config: config(), slots: [slot('s1'), slot('s2')], roster: [person('ann')], updatedAt: '2026-02-01T00:00:00.000Z' });
  store.set('publicLinks/pub1', { eventId: 'e1' });
};

let fb: typeof import('@/lib/firebase');

beforeEach(async () => {
  resetFake();
  callable.fail = false;
  callable.calls = 0;
  vi.resetModules();
  vi.stubEnv('VITE_FIREBASE_API_KEY', 'test-key');
  vi.stubEnv('VITE_FIREBASE_PROJECT_ID', 'test-project');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  fb = await import('@/lib/firebase');
});

describe('the rules file says what the app relies on', () => {
  const eventBlock = RULES.slice(RULES.indexOf('match /boothEvents/{eventId} {'), RULES.indexOf('match /publicLinks'));
  it('no longer lets everyone read and write events', () => {
    expect(RULES).not.toMatch(/allow read, write: if true/);
    expect(eventBlock).toMatch(/allow get: if true/);
    expect(eventBlock).toMatch(/allow list: if isAdmin\(\)/);
    expect(eventBlock).toMatch(/allow create, delete: if isAdmin\(\)/);
  });
  it('lets staff change only the fields the client writes', () => {
    const m = eventBlock.match(/hasOnly\(\[([^\]]*)\]\)/);
    const allowed = m![1].split(',').map((x) => x.trim().replace(/'/g, '')).sort();
    expect(allowed).toEqual([...fb.STAFF_WRITABLE_FIELDS].sort());
  });
  it('finds events by public link: readable one at a time, never listed, written by admins', () => {
    const block = RULES.slice(RULES.indexOf('match /publicLinks/{publicKey} {'));
    expect(block).toMatch(/allow get: if true/);
    expect(block).toMatch(/allow list: if false/);
    expect(block).toMatch(/allow write: if isAdmin\(\)/);
  });
  it('keeps module data and calendar tokens locked as before', () => {
    expect(RULES).toMatch(/modules\/\{moduleId\} \{\s*allow read, write: if isAdmin\(\)/);
    expect(RULES).toMatch(/organizerCalendarTokens\/\{eventId\} \{\s*allow read, write: if false/);
  });
});

describe('staff, signed out, using the open staff page', () => {
  beforeEach(() => {
    seed();
    mode.asAnonymous = true;
  });

  it('open the event from the public key, without listing any events', async () => {
    const found = await fb.fetchEventByKey('pub1');
    expect(found?.role).toBe('staff');
    expect(found?.data.config.title).toBe('Summit');
    expect(found?.data.slots).toHaveLength(2);
    expect(calls.getDocs).toBe(0);
  });

  it('get "not found" for a key that does not exist, not an error and not someone else\'s event', async () => {
    expect(await fb.fetchEventByKey('nope')).toBeNull();
  });

  it('cannot open an event through its admin key', async () => {
    expect(await fb.fetchEventByKey('adm1')).toBeNull();
  });

  it('cannot list events', async () => {
    await expect(fb.fetchAllEvents()).rejects.toThrow();
  });

  it('claim a shift with a write that changes only shifts, roster and time', async () => {
    const result = await fb.claimShiftAtomic('e1', 's1', booking('b1', 'ann') as never, 1);
    expect(result.success).toBe(true);
    const w = writes.filter((x) => x.path === 'boothEvents/e1');
    expect(w).toHaveLength(1);
    expect(w[0].op).toBe('update');
    for (const k of w[0].changed) expect(fb.STAFF_WRITABLE_FIELDS).toContain(k);
    for (const k of w[0].keys) expect(fb.STAFF_WRITABLE_FIELDS).toContain(k);
  });

  it('a claim books the slot, adds the hours, and leaves the event details untouched', async () => {
    await fb.claimShiftAtomic('e1', 's1', booking('b1', 'ann') as never, 1);
    const doc = store.get('boothEvents/e1') as Record<string, unknown> & { slots: { id: string; bookings: unknown[] }[]; roster: { totalBookedHours: number }[] };
    expect(doc.slots[0].bookings).toHaveLength(1);
    expect(doc.roster[0].totalBookedHours).toBe(1);
    expect(doc.config).toEqual(config());
    expect(doc.adminKey).toBe('adm1');
    expect(doc.publicKey).toBe('pub1');
  });

  it('are told when a slot has just been taken', async () => {
    store.set('boothEvents/e1', { ...(store.get('boothEvents/e1') as object), slots: [slot('s1', [booking('x', 'a'), booking('y', 'b')])] });
    const result = await fb.claimShiftAtomic('e1', 's1', booking('b1', 'ann') as never, 1);
    expect(result.success).toBe(false);
    expect(result.status).toBe(409);
  });

  it('release a shift or add themselves with a write limited to the same three fields', async () => {
    expect(await fb.pushStaffChange('e1', [slot('s1')] as never, [person('ann'), person('bob')] as never)).toBe(true);
    const w = writes.at(-1)!;
    expect(w.op).toBe('update');
    expect(w.keys.sort()).toEqual([...fb.STAFF_WRITABLE_FIELDS].sort());
    expect((store.get('boothEvents/e1') as { roster: unknown[] }).roster).toHaveLength(2);
  });
});

describe('admins', () => {
  beforeEach(seed);

  it('find an event by its admin key', async () => {
    const found = await fb.fetchEventByKey('adm1');
    expect(found?.role).toBe('admin');
    expect(found?.data.config.id).toBe('e1');
  });

  it('list events, each reporting its most recent change', async () => {
    const list = await fb.fetchAllEvents();
    expect(list).toHaveLength(1);
    expect(list[0].updatedAt).toBe('2026-02-01T00:00:00.000Z'); // the document moved on after staff changes; the config copy did not
  });

  it('creating an event writes the event and its public link, with no stakeholder or keynote data in it', async () => {
    const ok = await fb.pushEventToFirebase({ config: config({ id: 'e2', publicKey: 'pub2', adminKey: 'adm2' }), slots: [], roster: [] } as never);
    expect(ok).toBe(true);
    expect(store.get('publicLinks/pub2')).toEqual({ eventId: 'e2' });
    const doc = store.get('boothEvents/e2')!;
    expect(Object.keys(doc).sort()).toEqual(['adminKey', 'config', 'publicKey', 'roster', 'slots', 'updatedAt']);
  });

  it('backfill the public link for events that predate it, once, and say how many', async () => {
    store.delete('publicLinks/pub1');
    store.set('boothEvents/e3', { adminKey: 'a3', publicKey: 'pub3', config: config({ id: 'e3', publicKey: 'pub3' }), slots: [], roster: [], updatedAt: '' });
    expect(await fb.ensurePublicLinks()).toBe(2);
    expect(store.get('publicLinks/pub1')).toEqual({ eventId: 'e1' });
    expect(store.get('publicLinks/pub3')).toEqual({ eventId: 'e3' });
    expect(await fb.ensurePublicLinks()).toBe(0);
  });

  it('can open an event by its public key even before its link has been created', async () => {
    store.delete('publicLinks/pub1');
    const found = await fb.fetchEventByKey('pub1');
    expect(found?.role).toBe('staff');
    expect(found?.data.config.id).toBe('e1');
  });
});


describe('an admin change gives the event its staff link without needing the server function to', () => {
  const change = (over: Record<string, unknown> = {}) => ({ config: config({ id: 'e9', publicKey: 'pub9', adminKey: 'adm9', ...over }), slots: [], roster: [] }) as never;

  it('writes the staff link entry after the change is saved', async () => {
    expect(await fb.pushEventToFirebaseAsAdmin(change())).toBe(true);
    expect(callable.calls).toBe(1);
    expect(store.get('publicLinks/pub9')).toEqual({ eventId: 'e9' });
  });

  it('writes it once per event per session, not on every change', async () => {
    await fb.pushEventToFirebaseAsAdmin(change());
    await fb.pushEventToFirebaseAsAdmin(change());
    await fb.pushEventToFirebaseAsAdmin(change());
    expect(writes.filter((w) => w.path === 'publicLinks/pub9')).toHaveLength(1);
  });

  it('writes none if the change itself failed', async () => {
    callable.fail = true;
    expect(await fb.pushEventToFirebaseAsAdmin(change())).toBe(false);
    expect(store.has('publicLinks/pub9')).toBe(false);
  });

  it('still reports the change as saved if only the link write is refused', async () => {
    const original = store.set.bind(store);
    store.set = ((k: string, v: unknown) => {
      if (k.startsWith('publicLinks/')) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
      return original(k, v as never);
    }) as typeof store.set;
    try {
      expect(await fb.pushEventToFirebaseAsAdmin(change())).toBe(true);
    } finally {
      store.set = original;
    }
  });
});
