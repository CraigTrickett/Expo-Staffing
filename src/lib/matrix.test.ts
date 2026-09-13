import { describe, it, expect } from 'vitest';
import {
  parseTimeToMinutes,
  formatMinutesToTime,
  getDatesInRange,
  generateDeterministicSlots,
  updateSlotDerivedState,
  calculateCoverage,
} from './matrix';
import type { EventConfig, TimeSlot, StaffMember, ShiftBooking } from '@/types';

describe('parseTimeToMinutes', () => {
  it('converts HH:mm to total minutes', () => {
    expect(parseTimeToMinutes('09:00')).toBe(540);
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('23:45')).toBe(1425);
  });

  it('returns 0 for empty/missing input rather than throwing', () => {
    expect(parseTimeToMinutes('')).toBe(0);
  });
});

describe('formatMinutesToTime', () => {
  it('formats total minutes back to HH:mm', () => {
    expect(formatMinutesToTime(540)).toBe('09:00');
    expect(formatMinutesToTime(0)).toBe('00:00');
  });

  it('clamps out-of-range values instead of producing invalid times', () => {
    expect(formatMinutesToTime(-30)).toBe('00:00');
    expect(formatMinutesToTime(24 * 60 + 100)).toBe('24:00');
  });
});

describe('getDatesInRange', () => {
  it('returns a single date when start equals end', () => {
    expect(getDatesInRange('2026-06-15', '2026-06-15')).toEqual(['2026-06-15']);
  });

  it('returns every inclusive date across a multi-day range', () => {
    expect(getDatesInRange('2026-06-15', '2026-06-17')).toEqual([
      '2026-06-15',
      '2026-06-16',
      '2026-06-17',
    ]);
  });

  it('handles a range crossing a month boundary', () => {
    expect(getDatesInRange('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('falls back to a single day if start is after end, rather than looping forever', () => {
    expect(getDatesInRange('2026-06-17', '2026-06-15')).toEqual(['2026-06-17']);
  });
});

function baseConfig(overrides: Partial<EventConfig> = {}): EventConfig {
  return {
    id: 'evt_test',
    title: 'Test Event',
    description: '',
    location: 'Test Venue',
    timezone: 'UTC',
    startDate: '2026-06-15',
    endDate: '2026-06-15',
    dailyStartTime: '09:00',
    dailyEndTime: '11:00',
    slotDurationMinutes: 60,
    staffCapacityPerSlot: 2,
    adminKey: 'adm_test',
    publicKey: 'pub_test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('generateDeterministicSlots', () => {
  it('generates the correct number of slots for a single day window', () => {
    // 09:00-11:00 in 60-minute chunks = 2 slots
    const slots = generateDeterministicSlots(baseConfig());
    expect(slots).toHaveLength(2);
    expect(slots[0].startTime).toBe('09:00');
    expect(slots[0].endTime).toBe('10:00');
    expect(slots[1].startTime).toBe('10:00');
    expect(slots[1].endTime).toBe('11:00');
  });

  it('never generates a partial slot that would run past the daily end time', () => {
    // 09:00-10:30 window, 60-minute slots -> only one full slot fits
    const slots = generateDeterministicSlots(
      baseConfig({ dailyStartTime: '09:00', dailyEndTime: '10:30' })
    );
    expect(slots).toHaveLength(1);
    expect(slots[0].endTime).toBe('10:00');
  });

  it('carries the configured capacity onto every generated slot', () => {
    const slots = generateDeterministicSlots(baseConfig({ staffCapacityPerSlot: 5 }));
    expect(slots.every((s) => s.capacity === 5)).toBe(true);
  });

  it('generates slots across every day for a multi-day event', () => {
    const slots = generateDeterministicSlots(
      baseConfig({ startDate: '2026-06-15', endDate: '2026-06-16' })
    );
    expect(slots).toHaveLength(4); // 2 slots/day * 2 days
    const dates = new Set(slots.map((s) => s.date));
    expect(dates).toEqual(new Set(['2026-06-15', '2026-06-16']));
  });

  it('produces stable, unique slot IDs', () => {
    const slots = generateDeterministicSlots(baseConfig());
    const ids = slots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(slots[0].id).toBe('evt_test_2026-06-15_0900-1000');
  });
});

function baseSlot(overrides: Partial<TimeSlot> = {}): TimeSlot {
  return {
    id: 'slot_1',
    eventId: 'evt_test',
    date: '2026-06-15',
    startTime: '09:00',
    endTime: '10:00',
    capacity: 2,
    bookings: [],
    isFull: false,
    coveragePercentage: 0,
    ...overrides,
  };
}

function baseBooking(overrides: Partial<ShiftBooking> = {}): ShiftBooking {
  return {
    id: 'booking_1',
    slotId: 'slot_1',
    staffId: 'staff_1',
    staffName: 'Test Staffer',
    staffEmail: 'staffer@example.com',
    bookedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('updateSlotDerivedState', () => {
  it('marks a slot as not full below capacity', () => {
    const slot = updateSlotDerivedState(baseSlot({ capacity: 2, bookings: [baseBooking()] }));
    expect(slot.isFull).toBe(false);
    expect(slot.coveragePercentage).toBe(50);
  });

  it('marks a slot as full once bookings reach capacity', () => {
    const slot = updateSlotDerivedState(
      baseSlot({ capacity: 2, bookings: [baseBooking({ id: 'b1' }), baseBooking({ id: 'b2', staffId: 'staff_2' })] })
    );
    expect(slot.isFull).toBe(true);
    expect(slot.coveragePercentage).toBe(100);
  });

  it('never reports coverage above 100% even if overbooked past capacity', () => {
    const slot = updateSlotDerivedState(
      baseSlot({
        capacity: 1,
        bookings: [baseBooking({ id: 'b1' }), baseBooking({ id: 'b2', staffId: 'staff_2' })],
      })
    );
    expect(slot.coveragePercentage).toBe(100);
    expect(slot.isFull).toBe(true);
  });

  it('treats a zero/negative capacity as at least 1 to avoid divide-by-zero', () => {
    const slot = updateSlotDerivedState(baseSlot({ capacity: 0, bookings: [] }));
    expect(slot.coveragePercentage).toBe(0);
    expect(Number.isFinite(slot.coveragePercentage)).toBe(true);
  });
});

describe('calculateCoverage', () => {
  it('returns zeroed metrics for an event with no slots yet', () => {
    const roster: StaffMember[] = [
      { id: 's1', eventId: 'evt_test', name: 'A', email: '', totalBookedHours: 0, isConfirmed: false },
    ];
    const metrics = calculateCoverage([], roster);
    expect(metrics.totalSlots).toBe(0);
    expect(metrics.totalCapacityHours).toBe(0);
    expect(metrics.dynamicTargetHours).toBe(0);
    expect(metrics.unassignedStaffCount).toBe(1);
  });

  it('computes totalCapacityHours as capacity * duration summed across slots', () => {
    // Two 1-hour slots, capacity 2 each = 4 required person-hours.
    const slots = [
      baseSlot({ id: 's1', capacity: 2 }),
      baseSlot({ id: 's2', capacity: 2, startTime: '10:00', endTime: '11:00' }),
    ];
    const metrics = calculateCoverage(slots, []);
    expect(metrics.totalCapacityHours).toBe(4);
  });

  it('computes totalBookedHours from actual bookings, not capacity', () => {
    const slots = [
      baseSlot({ id: 's1', capacity: 2, bookings: [baseBooking()] }), // 1 of 2 filled, 1hr slot
    ];
    const metrics = calculateCoverage(slots, []);
    expect(metrics.totalBookedHours).toBe(1);
    expect(metrics.overallCoveragePercent).toBe(50);
  });

  it('counts understaffed slots correctly', () => {
    const slots = [
      baseSlot({ id: 's1', capacity: 2, bookings: [baseBooking()] }), // understaffed (1/2)
      baseSlot({ id: 's2', capacity: 1, bookings: [baseBooking({ id: 'b2' })] }), // fully staffed
    ];
    const metrics = calculateCoverage(slots, []);
    expect(metrics.understaffedSlotCount).toBe(1);
  });

  it('identifies unassigned roster members (no bookings anywhere)', () => {
    const slots = [baseSlot({ bookings: [baseBooking({ staffId: 'staff_1' })] })];
    const roster: StaffMember[] = [
      { id: 'staff_1', eventId: 'evt_test', name: 'Booked', email: '', totalBookedHours: 1, isConfirmed: true },
      { id: 'staff_2', eventId: 'evt_test', name: 'Not Booked', email: '', totalBookedHours: 0, isConfirmed: false },
    ];
    const metrics = calculateCoverage(slots, roster);
    expect(metrics.unassignedStaffCount).toBe(1);
  });

  it('computes dynamicTargetHours as totalCapacityHours divided evenly across the roster', () => {
    // 4 required person-hours, roster of 2 -> 2 hours each.
    const slots = [
      baseSlot({ id: 's1', capacity: 2 }),
      baseSlot({ id: 's2', capacity: 2, startTime: '10:00', endTime: '11:00' }),
    ];
    const roster: StaffMember[] = [
      { id: 's1', eventId: 'evt_test', name: 'A', email: '', totalBookedHours: 0, isConfirmed: false },
      { id: 's2', eventId: 'evt_test', name: 'B', email: '', totalBookedHours: 0, isConfirmed: false },
    ];
    const metrics = calculateCoverage(slots, roster);
    expect(metrics.dynamicTargetHours).toBe(2);
  });

  it('returns dynamicTargetHours of 0 for an empty roster, never dividing by zero', () => {
    const slots = [baseSlot()];
    const metrics = calculateCoverage(slots, []);
    expect(metrics.dynamicTargetHours).toBe(0);
    expect(Number.isFinite(metrics.dynamicTargetHours)).toBe(true);
  });
});
