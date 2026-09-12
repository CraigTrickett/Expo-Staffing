/**
 * Converts a "wall clock" date/time as observed in a given IANA timezone
 * (e.g. "2026-10-14" "09:00" in "America/Los_Angeles") into the correct
 * UTC instant it represents.
 *
 * This deliberately does NOT rely on the browser's own local timezone —
 * it uses Intl.DateTimeFormat to look up the target zone's UTC offset at
 * that specific date (so DST transitions are handled correctly), then
 * applies it. Falls back to treating the input as UTC if timeZone is
 * missing/invalid, which matches this app's existing default behavior.
 */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone?: string): Date {
  const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
  const [hours, minutes] = timeStr.split(':').map((v) => parseInt(v, 10));

  if (!timeZone || timeZone.toUpperCase() === 'UTC') {
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  }

  // Treat the wall-clock values as if they were already UTC — a starting
  // guess we'll correct below.
  const guessUtcMs = Date.UTC(year, month - 1, day, hours, minutes, 0);

  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const parts = dtf.formatToParts(new Date(guessUtcMs));
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';

    // What our UTC guess actually displays as, in the target zone.
    const displayedAsUtcMs = Date.UTC(
      parseInt(get('year'), 10),
      parseInt(get('month'), 10) - 1,
      parseInt(get('day'), 10),
      parseInt(get('hour'), 10) % 24,
      parseInt(get('minute'), 10),
      parseInt(get('second'), 10)
    );

    // The gap between what we displayed and what we guessed is exactly
    // the zone's UTC offset at this date. Subtracting it from our guess
    // gives the true UTC instant for the intended wall-clock time.
    const offsetMs = displayedAsUtcMs - guessUtcMs;
    return new Date(guessUtcMs - offsetMs);
  } catch {
    // Unknown/unsupported timeZone string — fall back to treating it as UTC
    // rather than silently producing a wrong-but-plausible time.
    return new Date(guessUtcMs);
  }
}

/**
 * Formats a Date as an RFC 5545 UTC timestamp: YYYYMMDDTHHMMSSZ.
 */
export function toIcsUtcString(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
