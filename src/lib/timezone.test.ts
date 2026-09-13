import { describe, it, expect } from 'vitest';
import { zonedTimeToUtc, toIcsUtcString } from './timezone';

describe('zonedTimeToUtc', () => {
  it('treats missing timezone as literal UTC', () => {
    const result = zonedTimeToUtc('2026-06-15', '09:00');
    expect(result.toISOString()).toBe('2026-06-15T09:00:00.000Z');
  });

  it('treats explicit "UTC" as literal UTC', () => {
    const result = zonedTimeToUtc('2026-06-15', '09:00', 'UTC');
    expect(result.toISOString()).toBe('2026-06-15T09:00:00.000Z');
  });

  it('converts America/Los_Angeles correctly in winter (PST, UTC-8)', () => {
    // Jan 15 is outside US daylight saving time.
    const result = zonedTimeToUtc('2026-01-15', '09:00', 'America/Los_Angeles');
    expect(result.toISOString()).toBe('2026-01-15T17:00:00.000Z');
  });

  it('converts America/Los_Angeles correctly in summer (PDT, UTC-7) — the DST case the old code got wrong', () => {
    // Jul 15 is inside US daylight saving time. This is exactly the
    // scenario that would break a fixed-offset (non-DST-aware) conversion.
    const result = zonedTimeToUtc('2026-07-15', '09:00', 'America/Los_Angeles');
    expect(result.toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });

  it('converts a timezone ahead of UTC, including the date rolling backward', () => {
    // Tokyo is UTC+9, so 09:00 local on the 15th is 00:00 UTC the same day.
    const result = zonedTimeToUtc('2026-03-15', '09:00', 'Asia/Tokyo');
    expect(result.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('converts a case where the date rolls forward across midnight UTC', () => {
    // Tokyo 23:00 local on the 15th is 14:00 UTC on the 15th... use a time
    // that actually crosses midnight instead: 01:00 JST on the 15th is
    // 16:00 UTC on the 14th.
    const result = zonedTimeToUtc('2026-03-15', '01:00', 'Asia/Tokyo');
    expect(result.toISOString()).toBe('2026-03-14T16:00:00.000Z');
  });

  it('falls back to treating the input as UTC for an invalid timezone string, rather than throwing', () => {
    const result = zonedTimeToUtc('2026-06-15', '09:00', 'Not/A_Real_Zone');
    expect(result.toISOString()).toBe('2026-06-15T09:00:00.000Z');
  });

  it('handles a half-hour offset timezone (India, UTC+5:30)', () => {
    const result = zonedTimeToUtc('2026-06-15', '09:00', 'Asia/Kolkata');
    expect(result.toISOString()).toBe('2026-06-15T03:30:00.000Z');
  });
});

describe('toIcsUtcString', () => {
  it('formats a Date as RFC 5545 UTC timestamp (YYYYMMDDTHHMMSSZ)', () => {
    const date = new Date('2026-06-15T09:00:00.000Z');
    expect(toIcsUtcString(date)).toBe('20260615T090000Z');
  });

  it('produces a string matching the exact RFC 5545 pattern', () => {
    const date = new Date('2026-01-05T23:45:07.000Z');
    expect(toIcsUtcString(date)).toMatch(/^\d{8}T\d{6}Z$/);
    expect(toIcsUtcString(date)).toBe('20260105T234507Z');
  });
});
