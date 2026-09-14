import type { EventConfig, TimeSlot } from '@/types';
import { formatDate, formatTime12h } from './utils';

/**
 * RFC 4180 field escaping: wrap in quotes if the value contains a comma,
 * quote, or line break, doubling any internal quotes. Plain values pass
 * through untouched, matching how most spreadsheet tools expect a CSV.
 */
export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: (string | number)[]): string {
  return fields.map((f) => escapeCsvField(String(f))).join(',');
}

/**
 * One row per slot — including open ones, not just booked ones — so this
 * doubles as a full staffing-gaps report, not only a "who worked when"
 * timesheet. Sorted chronologically regardless of the order slots happen
 * to be stored in.
 */
export function generateScheduleCsv(config: EventConfig, slots: TimeSlot[]): string {
  const header = toCsvRow([
    'Date',
    'Day',
    'Start Time',
    'End Time',
    'Capacity',
    'Booked',
    'Status',
    'Assigned Staff',
    'Assigned Emails',
  ]);

  const sortedSlots = [...slots].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  const rows = sortedSlots.map((slot) => {
    const dayLabel = formatDate(slot.date).split(',')[0]; // "Mon, Oct 14, 2026" -> "Mon"
    const status = slot.bookings.length === 0 ? 'Open' : slot.isFull ? 'Full' : 'Partially Staffed';
    const names = slot.bookings.map((b) => b.staffName).join('; ');
    const emails = slot.bookings.map((b) => b.staffEmail).filter(Boolean).join('; ');

    return toCsvRow([
      slot.date,
      dayLabel,
      formatTime12h(slot.startTime),
      formatTime12h(slot.endTime),
      slot.capacity,
      slot.bookings.length,
      status,
      names,
      emails,
    ]);
  });

  // CRLF line endings, matching the ICS export's convention and the
  // format most spreadsheet software expects for CSV specifically.
  return [header, ...rows].join('\r\n');
}

export function downloadCsv(filename: string, content: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  // Leading BOM so Excel (which otherwise guesses the wrong encoding for
  // non-ASCII names) opens this as UTF-8 correctly.
  const blob = new Blob(['\uFEFF', content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', safeFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadScheduleCsv(config: EventConfig, slots: TimeSlot[]): void {
  const csv = generateScheduleCsv(config, slots);
  const safeEvent = config.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
  downloadCsv(`${safeEvent}_schedule.csv`, csv);
}
