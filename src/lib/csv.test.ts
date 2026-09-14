import { describe, it, expect } from 'vitest';
import { escapeCsvField, generateScheduleCsv } from './csv';
import type { EventConfig, TimeSlot, ShiftBooking } from '@/types';

describe('escapeCsvField', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCsvField('Jane Doe')).toBe('Jane Doe');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCsvField('Doe, Jane')).toBe('"Doe, Jane"');
  });

  it('quotes and doubles internal quotes', () => {
    expect(escapeCsvField('Say "hi"')).toBe('"Say ""hi"""');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCsvField('Line one\nLine two')).toBe('"Line one\nLine two"');
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
    staffName: 'Jane Doe',
    staffEmail: 'jane@example.com',
    bookedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('generateScheduleCsv', () => {
  it('produces a header row followed by one row per slot', () => {
    const csv = generateScheduleCsv(baseConfig(), [baseSlot()]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Date,Day,Start Time,End Time,Capacity,Booked,Status,Assigned Staff,Assigned Emails');
    expect(lines).toHaveLength(2);
  });

  it('includes open slots with zero bookings, not just filled ones', () => {
    const csv = generateScheduleCsv(baseConfig(), [baseSlot({ bookings: [] })]);
    expect(csv).toContain('Open');
  });

  it('marks a slot at capacity as Full, and below capacity as Partially Staffed', () => {
    const full = generateScheduleCsv(baseConfig(), [
      baseSlot({ capacity: 1, bookings: [baseBooking()], isFull: true }),
    ]);
    expect(full).toContain('Full');

    const partial = generateScheduleCsv(baseConfig(), [
      baseSlot({ capacity: 2, bookings: [baseBooking()], isFull: false }),
    ]);
    expect(partial).toContain('Partially Staffed');
  });

  it('lists multiple assigned staff separated by semicolons', () => {
    const csv = generateScheduleCsv(baseConfig(), [
      baseSlot({
        capacity: 2,
        bookings: [
          baseBooking({ id: 'b1', staffName: 'Alex Rep', staffEmail: 'alex@example.com' }),
          baseBooking({ id: 'b2', staffId: 'staff_2', staffName: 'Sam Staffer', staffEmail: 'sam@example.com' }),
        ],
      }),
    ]);
    expect(csv).toContain('Alex Rep; Sam Staffer');
    expect(csv).toContain('alex@example.com; sam@example.com');
  });

  it('sorts rows chronologically regardless of input order', () => {
    const csv = generateScheduleCsv(baseConfig(), [
      baseSlot({ id: 's2', date: '2026-06-16', startTime: '09:00', endTime: '10:00' }),
      baseSlot({ id: 's1', date: '2026-06-15', startTime: '10:00', endTime: '11:00' }),
      baseSlot({ id: 's0', date: '2026-06-15', startTime: '09:00', endTime: '10:00' }),
    ]);
    const dateLines = csv.split('\r\n').slice(1).map((line) => line.split(',').slice(0, 3).join(','));
    expect(dateLines).toEqual([
      '2026-06-15,Mon,9:00 AM',
      '2026-06-15,Mon,10:00 AM',
      '2026-06-16,Tue,9:00 AM',
    ]);
  });

  it('quotes a staff name containing a comma so it does not break column alignment', () => {
    const csv = generateScheduleCsv(baseConfig(), [
      baseSlot({ bookings: [baseBooking({ staffName: 'Doe, Jane' })] }),
    ]);
    expect(csv).toContain('"Doe, Jane"');
  });

  it('produces an empty-but-valid CSV (header only) for an event with no slots yet', () => {
    const csv = generateScheduleCsv(baseConfig(), []);
    expect(csv.split('\r\n')).toHaveLength(1);
  });
});
