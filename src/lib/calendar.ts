import type { EventConfig, ShiftBooking, TimeSlot } from '@/types';
import { zonedTimeToUtc, toIcsUtcString } from './timezone';

/**
 * Escapes characters according to RFC 5545 section 3.3.11:
 * Backslashes, semicolons, commas, and newlines must be backslash-escaped.
 */
function escapeIcsText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Converts a date string (YYYY-MM-DD) and time string (HH:mm), as observed
 * in the event's own timezone, into an RFC 5545 UTC timestamp
 * (YYYYMMDDTHHMMSSZ). Correct regardless of which timezone the browser
 * generating the file happens to be in.
 */
export function formatIcsDateTime(dateStr: string, timeStr: string, timeZone?: string): string {
  return toIcsUtcString(zonedTimeToUtc(dateStr, timeStr, timeZone));
}

/**
 * Generates a standard RFC 5545 `.ics` payload matching UTC dates/times
 * with event title, booth location, shift details, and a 15-minute advance alarm.
 */
export function generateIcsFile(
  event: EventConfig,
  bookings: { slot: TimeSlot; booking: ShiftBooking }[]
): string {
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ExpoStaffing//ExpoStaffing Event Shift Scheduler v1.0//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(event.title)} - Expo Staffing`,
    `X-WR-TIMEZONE:${event.timezone || 'UTC'}`,
  ];

  for (const { slot, booking } of bookings) {
    const dtStart = formatIcsDateTime(slot.date, slot.startTime, event.timezone);
    const dtEnd = formatIcsDateTime(slot.date, slot.endTime, event.timezone);
    const uid = `${booking.id || slot.id}-${booking.staffId}@expostaffing.app`;

    const summary = `Expo Staffing: ${event.title}`;
    const description = `Shift assigned to ${booking.staffName} (${booking.staffEmail}) for ${event.title}.\nLocation: ${event.location || 'Exhibition Hall'}\n${event.description || ''}`;
    const location = event.location || 'Conference Exhibition Hall';

    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${dtStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `LOCATION:${escapeIcsText(location)}`,
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      `DESCRIPTION:Reminder: Expo Staffing Shift at ${escapeIcsText(event.title)} starts in 15 minutes`,
      'END:VALARM',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  // RFC 5545 specifies CRLF line endings
  return lines.join('\r\n');
}

/**
 * Triggers an in-browser blob download of the calendar file (.ics).
 */
export function downloadIcs(filename: string, content: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const safeFilename = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads .ics calendar for all shifts claimed by a specific staff member.
 */
export function downloadStaffScheduleIcs(
  event: EventConfig,
  slots: TimeSlot[],
  staff: ShiftBooking['staffId'] | { id: string; name: string }
): void {
  const staffId = typeof staff === 'string' ? staff : staff.id;
  const staffName = typeof staff === 'string' ? 'My' : staff.name;

  const userBookings: { slot: TimeSlot; booking: ShiftBooking }[] = [];

  for (const slot of slots) {
    const booking = slot.bookings.find((b) => b.staffId === staffId);
    if (booking) {
      userBookings.push({ slot, booking });
    }
  }

  if (userBookings.length === 0) return;

  const icsString = generateIcsFile(event, userBookings);
  const safeName = (typeof staff === 'object' ? staff.name : 'ExpoStaffing')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  downloadIcs(`${safeName}_expo_staffing.ics`, icsString);
}

/**
 * Downloads .ics calendar for all event shifts.
 */
export function downloadEventIcs(
  event: EventConfig,
  slots: TimeSlot[]
): void {
  const allBookings: { slot: TimeSlot; booking: ShiftBooking }[] = [];

  for (const slot of slots) {
    for (const booking of slot.bookings) {
      allBookings.push({ slot, booking });
    }
  }

  const icsString = generateIcsFile(event, allBookings);
  const safeEvent = event.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
  downloadIcs(`${safeEvent}_all_shifts.ics`, icsString);
}
