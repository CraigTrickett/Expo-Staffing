import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combines Tailwind CSS class names safely using clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Cryptographic token generator for secure adminKey and publicKey.
 * Generates an unguessable nano-identifier with an optional descriptive prefix.
 */
export function generateNanoKey(prefix?: string): string {
  let token = '';

  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') {
      token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    } else if (typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(12);
      crypto.getRandomValues(bytes);
      token = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  }

  if (!token) {
    token = (
      Math.random().toString(36).substring(2, 10) +
      Math.random().toString(36).substring(2, 10)
    ).slice(0, 16);
  }

  return prefix ? `${prefix}_${token}` : token;
}

/**
 * Converts a 24-hour time string ("HH:mm" or "H:mm") into a clean 12-hour AM/PM format.
 * Examples:
 *   "09:00" -> "9:00 AM"
 *   "13:30" -> "1:30 PM"
 *   "00:00" -> "12:00 AM"
 *   "12:00" -> "12:00 PM"
 */
export function formatTime12h(timeStr: string): string {
  if (!timeStr || !timeStr.includes(':')) {
    return timeStr;
  }

  const [hoursRaw, minutesRaw] = timeStr.split(':');
  const hours = parseInt(hoursRaw, 10);
  const minutes = parseInt(minutesRaw, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return timeStr;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 === 0 ? 12 : hours % 12;
  const minutesPadded = minutes.toString().padStart(2, '0');

  return `${hours12}:${minutesPadded} ${period}`;
}

/**
 * Alias for formatTime12h for standard convenience.
 */
export const formatTime = formatTime12h;

/**
 * Converts a duration in minutes into a clean, human-readable format.
 * Examples:
 *   30  -> "30m"
 *   60  -> "1h"
 *   90  -> "1h 30m"
 *   120 -> "2h"
 *   0   -> "0m"
 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Calculates duration in minutes between two "HH:mm" time strings.
 */
export function calculateSlotDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 60;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
  return diff > 0 ? diff : 60;
}

/**
 * Formats a calendar date string (YYYY-MM-DD) into an ergonomic display label.
 * Example: "2026-10-14" -> "Wed, Oct 14, 2026"
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const parts = dateString.split('-');
  if (parts.length !== 3) return dateString;

  const [year, month, day] = parts.map((n) => parseInt(n, 10));
  // Use UTC to avoid timezone drift
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
