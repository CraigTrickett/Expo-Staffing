import { describe, it, expect } from 'vitest';
import { isValidTimeZone, MAX_CAPACITY, MAX_ROSTER_NAMES, MAX_SHIFTS, normaliseCapacity, planEvent } from './eventPlan';

const base = { startDate: '2026-11-09', endDate: '2026-11-10', dailyStartTime: '09:00', dailyEndTime: '17:00', slotDurationMinutes: 60, staffCapacityPerSlot: 2 };

describe('planEvent', () => {
  it('a normal event is fine, and adds up', () => {
    expect(planEvent(base)).toMatchObject({ errors: [], warnings: [], days: 2, shiftsPerDay: 8, totalShifts: 16, lastShiftEnd: '17:00', leftoverMinutes: 0 });
  });

  it('warns, without blocking, when the day does not divide into whole shifts', () => {
    const p = planEvent({ ...base, slotDurationMinutes: 90 });
    expect(p.errors).toEqual([]);
    expect(p.shiftsPerDay).toBe(5);
    expect(p.lastShiftEnd).toBe('16:30');
    expect(p.warnings).toEqual(['The last shift ends at 16:30. The final 30 minutes of each day have no shift.']);
  });

  it('blocks daily hours shorter than one shift (it used to create an event with no shifts)', () => {
    const p = planEvent({ ...base, dailyStartTime: '09:00', dailyEndTime: '10:00', slotDurationMinutes: 120 });
    expect(p.errors).toEqual(['The daily hours are shorter than one 120-minute shift.']);
    expect(p.totalShifts).toBe(0);
  });

  it('blocks times that run backwards or are missing, and dates likewise', () => {
    expect(planEvent({ ...base, dailyStartTime: '18:00', dailyEndTime: '09:00' }).errors).toEqual(['The daily start time must be before the end time.']);
    expect(planEvent({ ...base, dailyStartTime: '', dailyEndTime: '' }).errors).toEqual(['Choose daily start and end times.']);
    expect(planEvent({ ...base, startDate: '2026-11-10', endDate: '2026-11-09' }).errors).toEqual(['The start date must be on or before the end date.']);
    expect(planEvent({ ...base, startDate: '' }).errors).toEqual(['Choose a start and end date.']);
    expect(planEvent({ ...base, endDate: '2026-02-30' }).errors).toEqual(['Choose a start and end date.']);
  });

  it('limits how many shifts an event can have, so its document stays under the database limit', () => {
    const ok = planEvent({ ...base, endDate: '2026-12-08', dailyStartTime: '06:00', dailyEndTime: '22:00', slotDurationMinutes: 30 }); // 30 days, 32 a day: 960
    expect(ok.errors).toEqual([]);
    expect(ok.totalShifts).toBe(960);
    const big = planEvent({ ...base, endDate: '2027-11-08', dailyStartTime: '06:00', dailyEndTime: '22:00', slotDurationMinutes: 30 }); // 365 days: 11,680
    expect(big.totalShifts).toBe(11680);
    expect(big.errors[0]).toMatch(/That makes 11,680 shifts, and the limit is 2,000/);
    expect(planEvent({ ...base, endDate: '2026-11-09', dailyStartTime: '00:00', dailyEndTime: '23:59', slotDurationMinutes: 30 }).errors).toEqual([]);
    expect(MAX_SHIFTS).toBe(2000);
  });

  it('limits staff per shift to a whole number from 1 to 100', () => {
    for (const bad of [0, -3, 2.5, NaN, 101, 1e6]) expect(planEvent({ ...base, staffCapacityPerSlot: bad }).errors, String(bad)).toEqual(['Staff per shift must be a whole number from 1 to 100.']);
    for (const good of [1, 2, 100]) expect(planEvent({ ...base, staffCapacityPerSlot: good }).errors).toEqual([]);
  });

  it('limits the pasted roster', () => {
    expect(planEvent({ ...base, rosterCount: MAX_ROSTER_NAMES }).errors).toEqual([]);
    expect(planEvent({ ...base, rosterCount: MAX_ROSTER_NAMES + 1 }).errors[0]).toMatch(/limited to 500 names/);
  });

  it('reports every problem at once', () => {
    expect(planEvent({ ...base, dailyEndTime: '08:00', staffCapacityPerSlot: 0, rosterCount: 9999 }).errors).toHaveLength(3);
  });
});

describe('normaliseCapacity', () => {
  it('turns anything into a whole number from 1 to 100', () => {
    expect(normaliseCapacity(2)).toBe(2);
    expect(normaliseCapacity(2.5)).toBe(3);
    expect(normaliseCapacity(0)).toBe(1);
    expect(normaliseCapacity(-4)).toBe(1);
    expect(normaliseCapacity(NaN)).toBe(1);
    expect(normaliseCapacity('abc')).toBe(1);
    expect(normaliseCapacity(undefined)).toBe(1);
    expect(normaliseCapacity(1e9)).toBe(MAX_CAPACITY);
    expect(normaliseCapacity('7')).toBe(7);
  });
});

describe('isValidTimeZone', () => {
  it('knows real zones and refuses the rest', () => {
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('America/Los_Angeles')).toBe(true);
    expect(isValidTimeZone('Not/AZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});
