import { describe, it, expect } from 'vitest';
import { generateIcsFile, formatIcsDateTime } from './calendar';
import type { EventConfig, TimeSlot, ShiftBooking } from '@/types';

function baseConfig(overrides: Partial<EventConfig> = {}): EventConfig {
  return {
    id: 'evt_test',
    title: 'Test Event',
    description: 'A test event',
    location: 'Test Venue',
    timezone: 'America/Los_Angeles',
    startDate: '2026-06-15',
    endDate: '2026-06-15',
    dailyStartTime: '09:00',
    dailyEndTime: '17:00',
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

describe('formatIcsDateTime', () => {
  it('produces a correctly timezone-converted RFC 5545 timestamp', () => {
    // 09:00 Pacific in summer (PDT, UTC-7) = 16:00 UTC
    expect(formatIcsDateTime('2026-07-15', '09:00', 'America/Los_Angeles')).toBe('20260715T160000Z');
  });
});

describe('generateIcsFile', () => {
  it('produces a well-formed VCALENDAR wrapper', () => {
    const ics = generateIcsFile(baseConfig(), [{ slot: baseSlot(), booking: baseBooking() }]);
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(ics).toContain('VERSION:2.0');
    expect(ics.trim().endsWith('END:VCALENDAR')).toBe(true);
  });

  it('uses CRLF line endings as required by RFC 5545', () => {
    const ics = generateIcsFile(baseConfig(), [{ slot: baseSlot(), booking: baseBooking() }]);
    expect(ics).toContain('\r\n');
    // Every line break should be CRLF, not a bare LF
    const bareLineFeeds = ics.split('\r\n').join('').includes('\n');
    expect(bareLineFeeds).toBe(false);
  });

  it('produces one VEVENT block per booking', () => {
    const ics = generateIcsFile(baseConfig(), [
      { slot: baseSlot({ id: 's1' }), booking: baseBooking({ id: 'b1' }) },
      { slot: baseSlot({ id: 's2', startTime: '10:00', endTime: '11:00' }), booking: baseBooking({ id: 'b2', staffId: 'staff_2' }) },
    ]);
    expect((ics.match(/BEGIN:VEVENT/g) || []).length).toBe(2);
    expect((ics.match(/END:VEVENT/g) || []).length).toBe(2);
  });

  it('produces correctly timezone-converted DTSTART/DTEND', () => {
    const ics = generateIcsFile(baseConfig(), [{ slot: baseSlot(), booking: baseBooking() }]);
    // 09:00-10:00 Pacific in summer = 16:00-17:00 UTC
    expect(ics).toContain('DTSTART:20260615T160000Z');
    expect(ics).toContain('DTEND:20260615T170000Z');
  });

  it('generates a unique UID per booking', () => {
    const ics = generateIcsFile(baseConfig(), [
      { slot: baseSlot({ id: 's1' }), booking: baseBooking({ id: 'b1' }) },
      { slot: baseSlot({ id: 's2' }), booking: baseBooking({ id: 'b2', staffId: 'staff_2' }) },
    ]);
    const uids = [...ics.matchAll(/UID:(\S+)/g)].map((m) => m[1]);
    expect(new Set(uids).size).toBe(2);
  });

  it('escapes commas in the event title so they are not read as field separators', () => {
    const ics = generateIcsFile(
      baseConfig({ title: 'Expo, Inc. Annual Conference' }),
      [{ slot: baseSlot(), booking: baseBooking() }]
    );
    expect(ics).toContain('Expo\\, Inc. Annual Conference');
  });

  it('escapes semicolons in the location field', () => {
    const ics = generateIcsFile(
      baseConfig({ location: 'Hall A; Booth 12' }),
      [{ slot: baseSlot(), booking: baseBooking() }]
    );
    expect(ics).toContain('LOCATION:Hall A\\; Booth 12');
  });

  it('escapes backslashes so they are not misread as escape sequences', () => {
    const ics = generateIcsFile(
      baseConfig({ location: 'C:\\Booths\\12' }),
      [{ slot: baseSlot(), booking: baseBooking() }]
    );
    expect(ics).toContain('C:\\\\Booths\\\\12');
  });

  it('escapes newlines within the description as literal \\n, not real line breaks', () => {
    const ics = generateIcsFile(
      baseConfig({ description: 'Line one\nLine two' }),
      [{ slot: baseSlot(), booking: baseBooking() }]
    );
    // The DESCRIPTION field's value should contain a literal backslash-n,
    // not an actual newline that would break ICS parsing.
    const descriptionLine = ics.split('\r\n').find((l) => l.startsWith('DESCRIPTION:'));
    expect(descriptionLine).toBeDefined();
    expect(descriptionLine).toContain('\\n');
  });

  it('falls back to a sensible default location when none is set', () => {
    const ics = generateIcsFile(
      baseConfig({ location: '' }),
      [{ slot: baseSlot(), booking: baseBooking() }]
    );
    expect(ics).toContain('LOCATION:Conference Exhibition Hall');
  });
});
