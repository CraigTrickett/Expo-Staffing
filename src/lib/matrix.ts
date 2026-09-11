import type { EventConfig, EventMetrics, StaffMember, TimeSlot } from '@/types';

/**
 * Converts a "HH:mm" time string into total elapsed minutes from 00:00.
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;
  return hours * 60 + minutes;
}

/**
 * Converts total minutes from 00:00 into a 24-hour "HH:mm" format.
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const normalized = Math.max(0, Math.min(24 * 60, totalMinutes));
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Generates an inclusive array of "YYYY-MM-DD" date strings between startDate and endDate.
 * Uses UTC date calculations to prevent timezone boundary drift.
 */
export function getDatesInRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const [sYear, sMonth, sDay] = startDateStr.split('-').map((val) => parseInt(val, 10));
  const [eYear, eMonth, eDay] = endDateStr.split('-').map((val) => parseInt(val, 10));

  if (Number.isNaN(sYear) || Number.isNaN(eYear)) {
    return [startDateStr];
  }

  const current = new Date(Date.UTC(sYear, sMonth - 1, sDay, 0, 0, 0));
  const end = new Date(Date.UTC(eYear, eMonth - 1, eDay, 0, 0, 0));

  // If start is after end, fallback to single day
  if (current.getTime() > end.getTime()) {
    return [startDateStr];
  }

  while (current.getTime() <= end.getTime()) {
    const year = current.getUTCFullYear();
    const month = (current.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = current.getUTCDate().toString().padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Generates deterministic TimeSlots for an event configuration.
 * Iterates through every day in [startDate, endDate] and breaks down
 * the daily window [dailyStartTime, dailyEndTime] into discrete steps
 * of length slotDurationMinutes.
 */
export function generateDeterministicSlots(config: EventConfig): TimeSlot[] {
  const dates = getDatesInRange(config.startDate, config.endDate);
  const startMinutes = parseTimeToMinutes(config.dailyStartTime);
  const endMinutes = parseTimeToMinutes(config.dailyEndTime);
  const duration = config.slotDurationMinutes;
  const capacity = config.staffCapacityPerSlot;

  const slots: TimeSlot[] = [];

  for (const date of dates) {
    let currentMinute = startMinutes;

    while (currentMinute + duration <= endMinutes) {
      const slotStartTime = formatMinutesToTime(currentMinute);
      const slotEndTime = formatMinutesToTime(currentMinute + duration);

      // Deterministic ID based on event ID, date, and times
      const slotId = `${config.id}_${date}_${slotStartTime.replace(':', '')}-${slotEndTime.replace(':', '')}`;

      slots.push({
        id: slotId,
        eventId: config.id,
        date,
        startTime: slotStartTime,
        endTime: slotEndTime,
        capacity,
        bookings: [],
        isFull: false,
        coveragePercentage: 0,
      });

      currentMinute += duration;
    }
  }

  return slots;
}

/**
 * Recomputes slot derived flags: isFull and coveragePercentage.
 */
export function updateSlotDerivedState(slot: TimeSlot): TimeSlot {
  const capacity = Math.max(1, slot.capacity);
  const bookingsCount = slot.bookings.length;
  const coveragePercentage = Math.min(100, Math.round((bookingsCount / capacity) * 100));
  const isFull = bookingsCount >= capacity;

  return {
    ...slot,
    coveragePercentage,
    isFull,
  };
}

/**
 * Calculates event-wide metrics and coverage status deterministically.
 * - totalSlots: total number of distinct shift slots
 * - totalCapacityHours: total required person-hours needed across all slots
 * - totalBookedHours: total staffed person-hours filled
 * - overallCoveragePercent: percentage of filled person-hours vs required
 * - unassignedStaffCount: number of roster staff with 0 booked shifts
 * - understaffedSlotCount: number of slots where bookings < capacity
 */
export function calculateCoverage(slots: TimeSlot[], roster: StaffMember[]): EventMetrics {
  const totalSlots = slots.length;

  if (totalSlots === 0) {
    return {
      totalSlots: 0,
      totalCapacityHours: 0,
      totalBookedHours: 0,
      overallCoveragePercent: 0,
      unassignedStaffCount: roster.length,
      understaffedSlotCount: 0,
      dynamicTargetHours: 0,
    };
  }

  let totalCapacityHours = 0;
  let totalBookedHours = 0;
  let understaffedSlotCount = 0;

  // Set to track staff who have at least one booking
  const activeStaffIds = new Set<string>();

  for (const slot of slots) {
    const slotDurationHours =
      (parseTimeToMinutes(slot.endTime) - parseTimeToMinutes(slot.startTime)) / 60;
    
    // Each slot requires (capacity * slotDurationHours) person-hours
    totalCapacityHours += slot.capacity * slotDurationHours;

    // Filled person-hours for this slot
    const bookedCount = slot.bookings.length;
    totalBookedHours += bookedCount * slotDurationHours;

    if (bookedCount < slot.capacity) {
      understaffedSlotCount++;
    }

    for (const booking of slot.bookings) {
      activeStaffIds.add(booking.staffId);
      if (booking.staffEmail) {
        activeStaffIds.add(booking.staffEmail.toLowerCase());
      }
    }
  }

  // Count unassigned staff in roster
  let unassignedStaffCount = 0;
  for (const member of roster) {
    const isBooked =
      activeStaffIds.has(member.id) ||
      (member.email && activeStaffIds.has(member.email.toLowerCase())) ||
      member.totalBookedHours > 0;

    if (!isBooked) {
      unassignedStaffCount++;
    }
  }

  const rawPercentage =
    totalCapacityHours > 0 ? (totalBookedHours / totalCapacityHours) * 100 : 0;
  const overallCoveragePercent = Math.round(rawPercentage * 10) / 10;

  const dynamicTargetHours = roster.length > 0
    ? Math.round((totalCapacityHours / roster.length) * 10) / 10
    : 0;

  return {
    totalSlots,
    totalCapacityHours: Math.round(totalCapacityHours * 10) / 10,
    totalBookedHours: Math.round(totalBookedHours * 10) / 10,
    overallCoveragePercent,
    unassignedStaffCount,
    understaffedSlotCount,
    dynamicTargetHours,
  };
}
