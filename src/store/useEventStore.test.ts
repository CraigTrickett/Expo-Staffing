// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

// The database is replaced, so the store's own rules are what is under test.
type Call = (...args: unknown[]) => Promise<unknown>;
const remote = {
  claim: vi.fn<Call>(),
  staffChange: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
  adminChange: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
};
vi.mock('@/lib/firebase', () => ({
  isFirebaseConfigured: false,
  claimShiftAtomic: (...a: unknown[]) => remote.claim(...a),
  pushStaffChange: (...a: unknown[]) => remote.staffChange(...a),
  pushEventToFirebaseAsAdmin: (...a: unknown[]) => remote.adminChange(...a),
  pushEventToFirebase: async () => true,
  fetchEventByKey: async () => null,
  subscribeToEvent: () => null,
}));
vi.mock('@/components/common/Toast', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { useEventStore } from './useEventStore';

const store = () => useEventStore.getState();
const payload = { title: 'Summit', startDate: '2026-11-09', endDate: '2026-11-09', dailyStartTime: '09:00', dailyEndTime: '12:00', slotDurationMinutes: 60 as const, staffCapacityPerSlot: 2, timezone: 'Europe/London', rosterNames: ['Ann', 'Bob', 'Cy'] };

beforeEach(() => {
  localStorage.clear();
  remote.claim.mockReset().mockResolvedValue({ success: true, status: 200 });
  remote.staffChange.mockClear();
  remote.adminChange.mockClear();
  useEventStore.setState({ currentEvent: null, slots: [], roster: [], currentStaff: null, error: null });
  store().createEvent(payload);
});

const as = (name: string) => {
  const member = store().roster.find((m) => m.name === name)!;
  store().claimIdentity(member.id);
  return member;
};

describe('a new event', () => {
  it('makes one shift per hour of the day, each holding the chosen number of staff', () => {
    expect(store().slots).toHaveLength(3);
    expect(store().slots.map((s) => s.startTime)).toEqual(['09:00', '10:00', '11:00']);
    expect(store().slots.every((s) => s.capacity === 2 && s.bookings.length === 0)).toBe(true);
    expect(store().roster.map((m) => m.name)).toEqual(['Ann', 'Bob', 'Cy']);
  });
  it('sends the creation to the database as an admin change', () => {
    expect(remote.adminChange).toHaveBeenCalledTimes(1);
  });
  it('clamps a capacity the form could never send', () => {
    store().createEvent({ ...payload, staffCapacityPerSlot: NaN });
    expect(store().slots[0].capacity).toBe(1);
    store().createEvent({ ...payload, staffCapacityPerSlot: 9999 });
    expect(store().slots[0].capacity).toBe(100);
  });
  it('replaces a time zone the browser does not know', () => {
    store().createEvent({ ...payload, timezone: 'Not/AZone' });
    expect(store().currentEvent!.timezone).not.toBe('Not/AZone');
  });
  it('keeps a long pasted roster to the limit', () => {
    store().createEvent({ ...payload, rosterNames: Array.from({ length: 800 }, (_, i) => `P${i}`) });
    expect(store().roster).toHaveLength(500);
  });
});

describe('claiming a shift', () => {
  it('needs an event and a person, and says so', async () => {
    useEventStore.setState({ currentStaff: null });
    expect(await store().claimShift(store().slots[0].id)).toBe(false);
    expect(store().error).toMatch(/select or enter your name/);
    useEventStore.setState({ currentEvent: null });
    expect(await store().claimShift('x')).toBe(false);
    expect(store().error).toBe('No active event.');
  });

  it('books the shift, adds the hours to the person, and updates coverage', async () => {
    const ann = as('Ann');
    expect(await store().claimShift(store().slots[0].id)).toBe(true);
    expect(store().slots[0].bookings.map((b) => b.staffName)).toEqual(['Ann']);
    expect(store().roster.find((m) => m.id === ann.id)!.totalBookedHours).toBe(1);
    expect(store().currentStaff!.totalBookedHours).toBe(1);
    expect(store().metrics.totalBookedHours).toBe(1);
    expect(remote.claim).toHaveBeenCalledTimes(1);
  });

  it('refuses a shift that is already full, without asking the database', async () => {
    as('Ann');
    const slotId = store().slots[0].id;
    await store().claimShift(slotId);
    as('Bob');
    await store().claimShift(slotId);
    as('Cy');
    expect(await store().claimShift(slotId)).toBe(false);
    expect(store().error).toBe('This shift is already at full capacity.');
    expect(remote.claim).toHaveBeenCalledTimes(2);
    expect(store().slots[0].bookings).toHaveLength(2);
  });

  it('refuses the same person claiming a shift twice', async () => {
    as('Ann');
    const slotId = store().slots[0].id;
    expect(await store().claimShift(slotId)).toBe(true);
    expect(await store().claimShift(slotId)).toBe(false);
    expect(store().error).toBe('You are already signed up for this shift.');
    expect(store().slots[0].bookings).toHaveLength(1);
  });

  it('lets one person take several different shifts', async () => {
    const ann = as('Ann');
    for (const s of store().slots) expect(await store().claimShift(s.id)).toBe(true);
    expect(store().roster.find((m) => m.id === ann.id)!.totalBookedHours).toBe(3);
  });

  it('undoes the booking if the database says someone else just took the last place', async () => {
    as('Ann');
    const slotId = store().slots[0].id;
    remote.claim.mockResolvedValue({ success: false, status: 409, conflict: true, message: 'Slot was just claimed by someone else! Matrix updated.' });
    expect(await store().claimShift(slotId)).toBe(false);
    expect(store().slots[0].bookings).toHaveLength(0);
    expect(store().currentStaff!.totalBookedHours).toBe(0);
    expect(store().error).toMatch(/just claimed by someone else/);
  });

  it('adopts what the database actually committed, not its own guess', async () => {
    as('Ann');
    const slotId = store().slots[0].id;
    const committed = store().slots.map((s) => (s.id === slotId ? { ...s, bookings: [{ id: 'other', slotId, staffId: 'zed', staffName: 'Zed', staffEmail: '', bookedAt: '' }, { id: 'mine', slotId, staffId: store().currentStaff!.id, staffName: 'Ann', staffEmail: '', bookedAt: '' }], isFull: true } : s));
    remote.claim.mockResolvedValue({ success: true, status: 200, committedSlots: committed, committedRoster: store().roster });
    await store().claimShift(slotId);
    expect(store().slots[0].bookings.map((b) => b.staffName)).toEqual(['Zed', 'Ann']);
  });
});

describe('releasing a shift', () => {
  it('frees the place and takes the hours back off', async () => {
    const ann = as('Ann');
    const slotId = store().slots[0].id;
    await store().claimShift(slotId);
    const bookingId = store().slots[0].bookings[0].id;
    expect(await store().releaseShift(slotId, bookingId)).toBe(true);
    expect(store().slots[0].bookings).toHaveLength(0);
    expect(store().roster.find((m) => m.id === ann.id)!.totalBookedHours).toBe(0);
    expect(store().currentStaff!.totalBookedHours).toBe(0);
  });

  it('sends only a staff change to the database: shifts and roster, not event details', async () => {
    as('Ann');
    const slotId = store().slots[0].id;
    await store().claimShift(slotId);
    remote.staffChange.mockClear();
    await store().releaseShift(slotId, store().slots[0].bookings[0].id);
    expect(remote.staffChange).toHaveBeenCalledTimes(1);
    expect(remote.staffChange.mock.calls[0][0]).toBe(store().currentEvent!.id);
  });

  it('does nothing for a shift or booking that does not exist', async () => {
    expect(await store().releaseShift('nope', 'nope')).toBe(false);
    expect(await store().releaseShift(store().slots[0].id, 'nope')).toBe(false);
  });

  it('leaves other people\'s bookings alone', async () => {
    as('Ann');
    const slotId = store().slots[0].id;
    await store().claimShift(slotId);
    as('Bob');
    await store().claimShift(slotId);
    const annBooking = store().slots[0].bookings.find((b) => b.staffName === 'Ann')!;
    await store().releaseShift(slotId, annBooking.id);
    expect(store().slots[0].bookings.map((b) => b.staffName)).toEqual(['Bob']);
  });
});

describe('a staff member adding themselves', () => {
  it('joins the roster, and the change goes to the database as a staff change', () => {
    remote.staffChange.mockClear();
    const me = store().claimIdentity('new', 'Dee', 'dee@x.com');
    expect(me).toMatchObject({ name: 'Dee', email: 'dee@x.com' });
    expect(store().roster.map((m) => m.name)).toContain('Dee');
    expect(store().currentStaff!.id).toBe(me.id);
    expect(remote.staffChange).toHaveBeenCalledTimes(1);
  });
  it('never creates a person with no name: blank becomes the default', () => {
    expect(store().claimIdentity('new', '   ').name).toBe('New Representative');
    expect(store().claimIdentity('new', '').name).toBe('New Representative');
    expect(store().roster.every((m) => m.name.length > 0)).toBe(true);
  });
  it('caps what a staff member types', () => {
    const me = store().claimIdentity('new', 'N'.repeat(500), `${'e'.repeat(500)}@x.com`);
    expect(me.name).toHaveLength(100);
    expect(me.email).toHaveLength(200);
  });
  it('treats a name already on the roster as that person, in any case', () => {
    const before = store().roster.length;
    expect(store().claimIdentity('new', 'ann').id).toBe(store().roster.find((m) => m.name === 'Ann')!.id);
    expect(store().roster).toHaveLength(before);
  });
  it('refuses an id that is not on the roster', () => {
    expect(() => store().claimIdentity('staff_missing')).toThrow(/not found/);
  });
});

describe('what only an admin can do goes through the admin route', () => {
  it('assigning, removing, resizing and renaming are admin changes', () => {
    remote.adminChange.mockClear();
    const slot = store().slots[0];
    store().updateSlotCapacity(slot.id, 5);
    expect(store().slots[0].capacity).toBe(5);
    store().updateEventDetails({ title: 'Renamed', location: 'Hall' });
    expect(store().currentEvent!.title).toBe('Renamed');
    store().adminAssignStaffToSlot(slot.id, store().roster[0]);
    expect(store().slots[0].bookings).toHaveLength(1);
    store().adminRemoveStaffFromSlot(slot.id, store().roster[0].id);
    expect(store().slots[0].bookings).toHaveLength(0);
    expect(remote.adminChange.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(remote.staffChange).not.toHaveBeenCalled();
  });
  it('does not assign the same person to a full shift', () => {
    const slot = store().slots[0];
    for (const m of store().roster.slice(0, 2)) store().adminAssignStaffToSlot(slot.id, m);
    expect(store().adminAssignStaffToSlot(slot.id, store().roster[2])).toBe(false);
  });
});
