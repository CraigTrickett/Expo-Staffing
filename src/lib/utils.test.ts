import { describe, it, expect } from 'vitest';
import {
  generateNanoKey,
  formatTime12h,
  formatDuration,
  calculateSlotDurationMinutes,
  formatDate,
  getTimezoneOptions,
  getBrowserTimezone,
  roundTargetHoursForDisplay,
} from './utils';

describe('generateNanoKey', () => {
  it('generates keys that are unique across many calls', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => generateNanoKey()));
    expect(keys.size).toBe(1000);
  });

  it('prefixes the key when a prefix is given', () => {
    const key = generateNanoKey('adm');
    expect(key.startsWith('adm_')).toBe(true);
  });

  it('omits the underscore separator when no prefix is given', () => {
    const key = generateNanoKey();
    expect(key.includes('_')).toBe(false);
  });
});

describe('formatTime12h', () => {
  it('formats standard morning and afternoon times', () => {
    expect(formatTime12h('09:00')).toBe('9:00 AM');
    expect(formatTime12h('13:30')).toBe('1:30 PM');
  });

  it('formats midnight as 12:00 AM, not 0:00 AM', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM');
  });

  it('formats noon as 12:00 PM, not 0:00 PM', () => {
    expect(formatTime12h('12:00')).toBe('12:00 PM');
  });

  it('returns the raw input unchanged for malformed input rather than showing "NaN:NaN"', () => {
    expect(formatTime12h('')).toBe('');
    expect(formatTime12h('not-a-time')).toBe('not-a-time');
  });
});

describe('formatDuration', () => {
  it('formats minutes-only durations', () => {
    expect(formatDuration(30)).toBe('30m');
  });

  it('formats whole-hour durations without a redundant "0m"', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats mixed hour+minute durations', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('formats zero or negative durations as "0m" rather than something misleading', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(-15)).toBe('0m');
  });
});

describe('calculateSlotDurationMinutes', () => {
  it('computes the correct duration between two times', () => {
    expect(calculateSlotDurationMinutes('09:00', '10:30')).toBe(90);
  });

  it('falls back to 60 minutes for a non-positive or invalid range, rather than a negative duration', () => {
    expect(calculateSlotDurationMinutes('10:00', '09:00')).toBe(60);
    expect(calculateSlotDurationMinutes('', '10:00')).toBe(60);
  });
});

describe('formatDate', () => {
  it('formats an ISO date string into a readable label', () => {
    expect(formatDate('2026-10-14')).toBe('Wed, Oct 14, 2026');
  });

  it('is not affected by the runtime\'s local timezone (uses UTC internally)', () => {
    // A date near a timezone boundary should still show the intended
    // calendar date, not shift a day forward/backward.
    expect(formatDate('2026-01-01')).toBe('Thu, Jan 1, 2026');
  });

  it('returns an empty string for empty input rather than "Invalid Date"', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('getTimezoneOptions', () => {
  it('returns a non-empty, alphabetically sorted list of real IANA zones', () => {
    const options = getTimezoneOptions();
    expect(options.length).toBeGreaterThan(50);
    const values = options.map((o) => o.value);
    expect([...values].sort((a, b) => a.localeCompare(b))).toEqual(values);
  });

  it('includes well-known zones with a readable UTC-offset label', () => {
    const options = getTimezoneOptions();
    const la = options.find((o) => o.value === 'America/Los_Angeles');
    expect(la).toBeDefined();
    expect(la!.label).toMatch(/America\/Los_Angeles \(GMT[+-]\d+\)/);
  });

  it('every option is a valid, distinct IANA identifier', () => {
    const options = getTimezoneOptions();
    const values = options.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('getBrowserTimezone', () => {
  it('returns a non-empty timezone string', () => {
    expect(getBrowserTimezone().length).toBeGreaterThan(0);
  });
});

describe('roundTargetHoursForDisplay', () => {
  it('rounds a fractional target up to the next whole number', () => {
    expect(roundTargetHoursForDisplay(3.4)).toBe(4);
    expect(roundTargetHoursForDisplay(4.8)).toBe(5);
  });

  it('leaves an already-whole target unchanged', () => {
    expect(roundTargetHoursForDisplay(4)).toBe(4);
  });

  it('rounds up even a tiny fraction, never down', () => {
    expect(roundTargetHoursForDisplay(3.01)).toBe(4);
  });

  it('treats zero, negative, and non-finite input as zero rather than throwing', () => {
    expect(roundTargetHoursForDisplay(0)).toBe(0);
    expect(roundTargetHoursForDisplay(-2)).toBe(0);
    expect(roundTargetHoursForDisplay(NaN)).toBe(0);
    expect(roundTargetHoursForDisplay(Infinity)).toBe(0);
  });
});
