/**
 * What a new event's settings add up to, and whether they are sensible. The create form shows this as
 * the person types, and the store applies the same limits, so an event cannot be made that the app or
 * its database cannot hold.
 */
export const MAX_SHIFTS = 2000;
export const MAX_ROSTER_NAMES = 500;
export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 100;

export interface EventPlanInput {
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  slotDurationMinutes: number;
  staffCapacityPerSlot: number;
  rosterCount?: number;
}

export interface EventPlan {
  /** Reasons the event cannot be created as set up. */
  errors: string[];
  /** Things to know that do not stop it. */
  warnings: string[];
  days: number;
  shiftsPerDay: number;
  totalShifts: number;
  /** When the last shift of a day ends, HH:MM. */
  lastShiftEnd: string;
  /** Minutes at the end of each day that no shift covers. */
  leftoverMinutes: number;
}

const toMinutes = (t: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t || '');
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? NaN : h * 60 + min;
};
const hhmm = (total: number) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
const dayNumber = (iso: string): number => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return NaN;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const back = new Date(t);
  // Reject dates that roll over, such as 2026-02-30.
  return back.getUTCFullYear() === Number(m[1]) && back.getUTCMonth() === Number(m[2]) - 1 && back.getUTCDate() === Number(m[3]) ? t / 86_400_000 : NaN;
};

/** A staff-per-shift figure the app can use: a whole number from 1 to 100. Anything else becomes the nearest sensible one. */
export function normaliseCapacity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return MIN_CAPACITY;
  return Math.min(MAX_CAPACITY, Math.max(MIN_CAPACITY, Math.round(n)));
}

/** True if the browser knows this time zone. */
export function isValidTimeZone(zone: string): boolean {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function planEvent(input: EventPlanInput): EventPlan {
  const errors: string[] = [];
  const warnings: string[] = [];
  const slot = input.slotDurationMinutes;

  const first = dayNumber(input.startDate);
  const last = dayNumber(input.endDate);
  let days = 0;
  if (Number.isNaN(first) || Number.isNaN(last)) errors.push('Choose a start and end date.');
  else if (last < first) errors.push('The start date must be on or before the end date.');
  else days = last - first + 1;

  const start = toMinutes(input.dailyStartTime);
  const end = toMinutes(input.dailyEndTime);
  let shiftsPerDay = 0;
  let leftoverMinutes = 0;
  let lastShiftEnd = '';
  if (Number.isNaN(start) || Number.isNaN(end)) errors.push('Choose daily start and end times.');
  else if (end <= start) errors.push('The daily start time must be before the end time.');
  else if (!(slot > 0)) errors.push('Choose a shift length.');
  else {
    const window = end - start;
    shiftsPerDay = Math.floor(window / slot);
    leftoverMinutes = window % slot;
    lastShiftEnd = hhmm(start + shiftsPerDay * slot);
    if (shiftsPerDay === 0) errors.push(`The daily hours are shorter than one ${slot}-minute shift.`);
    else if (leftoverMinutes > 0) {
      warnings.push(`The last shift ends at ${lastShiftEnd}. The final ${leftoverMinutes} minutes of each day have no shift.`);
    }
  }

  const totalShifts = days * shiftsPerDay;
  if (totalShifts > MAX_SHIFTS) {
    errors.push(
      `That makes ${totalShifts.toLocaleString('en-GB')} shifts, and the limit is ${MAX_SHIFTS.toLocaleString('en-GB')}. Shorten the event or its daily hours, or use longer shifts.`
    );
  }

  const cap = input.staffCapacityPerSlot;
  if (!Number.isInteger(cap) || cap < MIN_CAPACITY || cap > MAX_CAPACITY) {
    errors.push(`Staff per shift must be a whole number from ${MIN_CAPACITY} to ${MAX_CAPACITY}.`);
  }

  if ((input.rosterCount ?? 0) > MAX_ROSTER_NAMES) {
    errors.push(`The roster is limited to ${MAX_ROSTER_NAMES} names. Staff can add themselves from the staff page.`);
  }

  return { errors, warnings, days, shiftsPerDay, totalShifts, lastShiftEnd, leftoverMinutes };
}
