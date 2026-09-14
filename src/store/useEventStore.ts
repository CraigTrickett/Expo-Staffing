import { create } from 'zustand';
import type {
  EventConfig,
  EventMetrics,
  ShiftBooking,
  StaffMember,
  StoredEventData,
  TimeSlot,
  WizardPayload,
} from '@/types';
import {
  calculateCoverage,
  generateDeterministicSlots,
  parseTimeToMinutes,
  updateSlotDerivedState,
} from '@/lib/matrix';
import { generateNanoKey } from '@/lib/utils';
import { storage, DEMO_ADMIN_KEY, DEMO_PUBLIC_KEY, createDemoEvent } from '@/lib/storage';
import { claimShiftAtomic, fetchEventByKey, pushEventToFirebase, pushEventToFirebaseAsAdmin, subscribeToEvent } from '@/lib/firebase';
import { toast } from '@/components/common/Toast';

interface EventStoreState {
  currentEvent: EventConfig | null;
  slots: TimeSlot[];
  roster: StaffMember[];
  currentStaff: StaffMember | null;
  metrics: EventMetrics;
  isLoading: boolean;
  error: string | null;
  optimisticRollbackCache: { slotId: string; bookingId: string } | null;
  role: 'admin' | 'staff' | null;

  // Actions
  createEvent: (payload: WizardPayload) => { adminKey: string; publicKey: string };
  loadEventByKey: (key: string) => Promise<'admin' | 'staff' | 'not_found'>;
  claimIdentity: (staffId: string | 'new', newName?: string, newEmail?: string) => StaffMember;
  claimShift: (slotId: string) => Promise<boolean>;
  releaseShift: (slotId: string, bookingId: string) => Promise<boolean>;
  addRosterMember: (name: string, email?: string) => StaffMember;
  removeRosterMember: (staffId: string) => void;
  updateRosterMember: (staffId: string, updates: { name?: string; email?: string }) => void;
  updateSlotCapacity: (slotId: string, newCapacity: number) => void;
  updateDefaultSlotCapacity: (newCapacity: number) => void;
  updateEventTimezone: (newTimezone: string) => void;
  updateEventDetails: (updates: { title: string; location: string }) => void;
  adminAssignStaffToSlot: (slotId: string, staff: StaffMember) => boolean;
  adminRemoveStaffFromSlot: (slotId: string, staffId: string) => void;
  clearError: () => void;
  resetToDemo: () => void;
}

const emptyMetrics: EventMetrics = {
  totalSlots: 0,
  totalCapacityHours: 0,
  totalBookedHours: 0,
  overallCoveragePercent: 0,
  unassignedStaffCount: 0,
  understaffedSlotCount: 0,
  dynamicTargetHours: 0,
};

/**
 * Recomputes all staff totalBookedHours from scratch based on actual slot bookings.
 */
function recalculateStaffHours(slots: TimeSlot[], roster: StaffMember[]): StaffMember[] {
  const hoursMap = new Map<string, number>();

  for (const slot of slots) {
    const slotDurationHours =
      (parseTimeToMinutes(slot.endTime) - parseTimeToMinutes(slot.startTime)) / 60;
    for (const booking of slot.bookings) {
      const current = hoursMap.get(booking.staffId) || 0;
      hoursMap.set(booking.staffId, current + slotDurationHours);
    }
  }

  return roster.map((member) => ({
    ...member,
    totalBookedHours: Math.round((hoursMap.get(member.id) || 0) * 10) / 10,
  }));
}

/**
 * Fire-and-forget push to the remote backend (when configured). Never
 * awaited by callers — localStorage is always written first and remains
 * the source of truth for the current tab; this just keeps other
 * devices in sync. Failures are logged inside pushEventToFirebase itself.
 */
/**
 * Pushes a change to the database. Now that Firebase is a hard
 * requirement (the app won't even render without it — see App.tsx), a
 * failure here means the change genuinely was not saved anywhere shared,
 * which the user needs to know rather than have it silently vanish into
 * a local-only copy.
 */
function syncToRemote(config: EventConfig, slots: TimeSlot[], roster: StaffMember[]): void {
  pushEventToFirebase({ config, slots, roster }).then((ok) => {
    if (!ok) {
      toast.error(
        'Your last change could not be saved to the database. Check your connection and try again.',
        'Not Saved'
      );
    }
  });
}

/**
 * Same as syncToRemote, but for admin-only mutations (capacity, roster,
 * slot assignment): routed through the authenticated adminUpdateEvent
 * Cloud Function instead of a direct client write, since those actions
 * should only ever succeed for a signed-in, allowlisted admin.
 */
function syncToRemoteAsAdmin(config: EventConfig, slots: TimeSlot[], roster: StaffMember[]): void {
  pushEventToFirebaseAsAdmin({ config, slots, roster }).then((ok) => {
    if (!ok) {
      toast.error(
        'Your last change could not be saved to the database. Check your connection and try again.',
        'Not Saved'
      );
    }
  });
}

/**
 * Returns a copy of the config with a fresh updatedAt. Every mutation that
 * changes slots or roster must call this — the "My Events" recovery panel
 * sorts by updatedAt, so it needs to actually reflect the last real change.
 */
function touchConfig(config: EventConfig): EventConfig {
  return { ...config, updatedAt: new Date().toISOString() };
}

let liveUnsubscribe: (() => void) | null = null;

/**
 * Subscribes to live Firestore updates for the given event so every
 * device viewing it stays in sync within about a second, with no polling.
 * Replaces any previous subscription (e.g. when switching events) and is
 * a no-op when Firebase isn't configured.
 */
function attachLiveSync(
  eventId: string,
  set: (partial: Partial<EventStoreState>) => void,
  get: () => EventStoreState
): void {
  if (liveUnsubscribe) {
    liveUnsubscribe();
    liveUnsubscribe = null;
  }

  const unsubscribe = subscribeToEvent(eventId, (data) => {
    const { currentEvent, currentStaff } = get();
    // Ignore snapshots for an event we've since navigated away from.
    if (!currentEvent || currentEvent.id !== eventId) return;

    const synchronizedRoster = recalculateStaffHours(data.slots, data.roster);
    const normalizedSlots = data.slots.map(updateSlotDerivedState);
    const metrics = calculateCoverage(normalizedSlots, synchronizedRoster);

    storage.saveEvent({ config: data.config, slots: normalizedSlots, roster: synchronizedRoster });

    set({
      currentEvent: data.config,
      slots: normalizedSlots,
      roster: synchronizedRoster,
      currentStaff: currentStaff
        ? synchronizedRoster.find((m) => m.id === currentStaff.id) || currentStaff
        : null,
      metrics,
    });
  });

  liveUnsubscribe = unsubscribe;
}

export const useEventStore = create<EventStoreState>((set, get) => ({
  currentEvent: null,
  slots: [],
  roster: [],
  currentStaff: null,
  metrics: emptyMetrics,
  isLoading: false,
  error: null,
  optimisticRollbackCache: null,
  role: null,

  createEvent: (payload: WizardPayload) => {
    const adminKey = generateNanoKey('adm');
    const publicKey = generateNanoKey('pub');
    const eventId = `evt_${generateNanoKey()}`;

    const newConfig: EventConfig = {
      id: eventId,
      title: payload.title.trim(),
      description:
        payload.description?.trim() ||
        `Expo staffing schedule for ${payload.title.trim()}. Self-service shift signup powered by Expo Staffing.`,
      location: payload.location?.trim() || '',
      timezone: payload.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
      startDate: payload.startDate,
      endDate: payload.endDate,
      dailyStartTime: payload.dailyStartTime,
      dailyEndTime: payload.dailyEndTime,
      slotDurationMinutes: payload.slotDurationMinutes,
      staffCapacityPerSlot: Math.max(1, payload.staffCapacityPerSlot),
      adminKey,
      publicKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const initialRoster: StaffMember[] = (payload.rosterNames || [])
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name, idx) => ({
        id: `staff_${generateNanoKey()}_${idx}`,
        eventId,
        name,
        email: '',
        totalBookedHours: 0,
        isConfirmed: false,
      }));

    const rawSlots = generateDeterministicSlots(newConfig);
    const slots = rawSlots.map(updateSlotDerivedState);
    const metrics = calculateCoverage(slots, initialRoster);

    // Persist to storage
    storage.saveEvent({
      config: newConfig,
      slots,
      roster: initialRoster,
    });
    syncToRemoteAsAdmin(newConfig, slots, initialRoster);

    set({
      currentEvent: newConfig,
      slots,
      roster: initialRoster,
      currentStaff: initialRoster[0] || null,
      metrics,
      error: null,
      role: 'admin',
    });

    return { adminKey, publicKey };
  },

  loadEventByKey: async (key: string) => {
    set({ isLoading: true, error: null });

    const trimmed = (key || '').trim();
    if (!trimmed) {
      set({ isLoading: false, error: 'Invalid or missing access key.' });
      return 'not_found';
    }

    let result: { data: StoredEventData; role: 'admin' | 'staff' } | null;
    try {
      result = await fetchEventByKey(trimmed);
    } catch (err) {
      console.warn('[loadEventByKey] Could not reach the database:', err);
      set({
        currentEvent: null,
        slots: [],
        roster: [],
        currentStaff: null,
        metrics: emptyMetrics,
        isLoading: false,
        error: 'Could not reach the database. Check your connection and try again.',
        role: null,
      });
      return 'not_found';
    }

    // The demo event lives at a fixed, well-known key pair reached from
    // the landing page banner. If nobody has ever created it in the
    // database yet (a brand-new deployment's very first "Explore Demo"
    // click), seed it now rather than reporting "not found."
    if (!result && (trimmed === DEMO_ADMIN_KEY || trimmed === DEMO_PUBLIC_KEY)) {
      const demo = createDemoEvent();
      const pushed = await pushEventToFirebase(demo);
      if (pushed) {
        result = { data: demo, role: trimmed === DEMO_ADMIN_KEY ? 'admin' : 'staff' };
      }
    }

    if (!result) {
      set({
        currentEvent: null,
        slots: [],
        roster: [],
        currentStaff: null,
        metrics: emptyMetrics,
        isLoading: false,
        error: `Schedule not found for key: ${trimmed}`,
        role: null,
      });
      return 'not_found';
    }

    const { data, role } = result;
    const synchronizedRoster = recalculateStaffHours(data.slots, data.roster);
    const normalizedSlots = data.slots.map(updateSlotDerivedState);
    const metrics = calculateCoverage(normalizedSlots, synchronizedRoster);

    // Mirror whatever we loaded (remote or local) into this browser's
    // local cache, so it's still usable offline next time.
    storage.saveEvent({ config: data.config, slots: normalizedSlots, roster: synchronizedRoster });

    // Retrieve previously selected identity for this event
    const savedStaffId = storage.getPersistedStaffId(data.config.id);
    let matchedStaff: StaffMember | null = null;
    if (savedStaffId) {
      matchedStaff = synchronizedRoster.find((m) => m.id === savedStaffId) || null;
    }
    if (!matchedStaff && synchronizedRoster.length > 0 && role === 'admin') {
      matchedStaff = synchronizedRoster[0];
    }

    set({
      currentEvent: data.config,
      slots: normalizedSlots,
      roster: synchronizedRoster,
      currentStaff: matchedStaff,
      metrics,
      isLoading: false,
      error: null,
      role,
    });

    attachLiveSync(data.config.id, set, get);

    return role;
  },

  claimIdentity: (staffId: string | 'new', newName?: string, newEmail?: string) => {
    const { currentEvent, roster, slots } = get();
    if (!currentEvent) {
      throw new Error('No active event loaded.');
    }

    let targetMember: StaffMember;

    if (staffId === 'new' || !staffId) {
      const cleanName = (newName || 'New Representative').trim();
      const cleanEmail = (newEmail || '').trim();

      // Check if already in roster by name or email
      const existing = roster.find(
        (m) =>
          m.name.toLowerCase() === cleanName.toLowerCase() ||
          (cleanEmail && m.email.toLowerCase() === cleanEmail.toLowerCase())
      );

      if (existing) {
        targetMember = existing;
      } else {
        targetMember = {
          id: `staff_${generateNanoKey()}`,
          eventId: currentEvent.id,
          name: cleanName,
          email: cleanEmail,
          totalBookedHours: 0,
          isConfirmed: true,
        };
        const updatedRoster = [...roster, targetMember];
        const nextConfig = touchConfig(currentEvent);
        storage.saveEvent({
          config: nextConfig,
          slots,
          roster: updatedRoster,
        });
        syncToRemote(nextConfig, slots, updatedRoster);
        set({ currentEvent: nextConfig, roster: updatedRoster });
      }
    } else {
      const found = roster.find((m) => m.id === staffId);
      if (!found) {
        throw new Error(`Staff member with ID ${staffId} not found.`);
      }
      targetMember = found;
    }

    // Persist active staff ID in localStorage
    storage.setPersistedStaffId(currentEvent.id, targetMember.id);

    set({ currentStaff: targetMember, error: null });
    return targetMember;
  },

  claimShift: async (slotId: string): Promise<boolean> => {
    const state = get();
    const { currentStaff, currentEvent, slots, roster } = state;

    if (!currentEvent) {
      set({ error: 'No active event.' });
      return false;
    }

    if (!currentStaff) {
      set({ error: 'Please select or enter your name before claiming a shift.' });
      return false;
    }

    const slotIndex = slots.findIndex((s) => s.id === slotId);
    if (slotIndex === -1) {
      set({ error: 'Shift slot not found.' });
      return false;
    }

    const targetSlot = slots[slotIndex];

    // Guardrail 1: Slot already reached capacity
    if (targetSlot.bookings.length >= targetSlot.capacity) {
      set({ error: 'This shift is already at full capacity.' });
      return false;
    }

    // Guardrail 2: Staff already booked for this slot
    if (targetSlot.bookings.some((b) => b.staffId === currentStaff.id)) {
      set({ error: 'You are already signed up for this shift.' });
      return false;
    }

    const bookingId = `bk_${generateNanoKey()}`;
    const newBooking: ShiftBooking = {
      id: bookingId,
      slotId,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      staffEmail: currentStaff.email,
      bookedAt: new Date().toISOString(),
      isOptimistic: true,
    };

    // Calculate shift duration in hours
    const durationHours =
      (parseTimeToMinutes(targetSlot.endTime) - parseTimeToMinutes(targetSlot.startTime)) / 60;

    // OPTIMISTIC UPDATE:
    // Update slot with new booking
    const updatedSlot = updateSlotDerivedState({
      ...targetSlot,
      bookings: [...targetSlot.bookings, newBooking],
    });

    const nextSlots = [...slots];
    nextSlots[slotIndex] = updatedSlot;

    // Update staff hours
    const updatedStaff: StaffMember = {
      ...currentStaff,
      totalBookedHours: Math.round((currentStaff.totalBookedHours + durationHours) * 10) / 10,
    };

    const nextRoster = roster.map((m) => (m.id === currentStaff.id ? updatedStaff : m));
    const nextMetrics = calculateCoverage(nextSlots, nextRoster);

    // Set optimistic state immediately
    set({
      slots: nextSlots,
      currentStaff: updatedStaff,
      roster: nextRoster,
      metrics: nextMetrics,
      optimisticRollbackCache: { slotId, bookingId },
      error: null,
    });

    try {
      // Atomic claim: this check and the actual write happen together as
      // one Firestore transaction, closing the race window the previous
      // check-then-separately-write pattern had (see claimShiftAtomic's
      // own comment for the full reasoning).
      const remoteCheck = await claimShiftAtomic(currentEvent.id, slotId, newBooking, durationHours);

      if (remoteCheck.status === 409 || remoteCheck.conflict) {
        const conflictMsg =
          remoteCheck.message || 'Slot was just claimed by someone else! Matrix updated.';

        // Perform rollback of optimistic assignment
        const rollbackSlots = [...slots];
        rollbackSlots[slotIndex] = targetSlot;
        const rollbackStaff = currentStaff;
        const rollbackRoster = roster;
        const rollbackMetrics = calculateCoverage(rollbackSlots, rollbackRoster);

        set({
          slots: rollbackSlots,
          currentStaff: rollbackStaff,
          roster: rollbackRoster,
          metrics: rollbackMetrics,
          optimisticRollbackCache: null,
          error: conflictMsg,
        });

        toast.error(conflictMsg, 'Shift Conflict');
        return false;
      }

      // Reconcile local state with what the transaction actually
      // committed (when Firebase is configured) rather than trusting our
      // own pre-transaction guess — the two could differ under real
      // concurrent activity. Falls back to the locally-computed values
      // when running without a configured backend.
      const finalSlots = remoteCheck.committedSlots || nextSlots;
      const finalRoster = remoteCheck.committedRoster || nextRoster;
      const finalMetrics = calculateCoverage(finalSlots, finalRoster);
      const finalStaff = finalRoster.find((m) => m.id === currentStaff.id) || updatedStaff;

      // Persist to local cache. The remote write already happened inside
      // claimShiftAtomic's transaction when Firebase is configured — no
      // separate syncToRemote call here, since that would be a second,
      // non-atomic overwrite that could undo the safety the transaction
      // just provided.
      const nextConfig = touchConfig(currentEvent);
      storage.saveEvent({
        config: nextConfig,
        slots: finalSlots,
        roster: finalRoster,
      });

      set({
        currentEvent: nextConfig,
        slots: finalSlots,
        roster: finalRoster,
        currentStaff: finalStaff,
        metrics: finalMetrics,
        optimisticRollbackCache: null,
      });
      toast.success(
        `Claimed ${targetSlot.startTime} - ${targetSlot.endTime} shift!`,
        'Shift Confirmed'
      );
      return true;
    } catch (err) {
      // Rollback optimistic update
      console.error('[claimShift] Storage failed, rolling back:', err);
      const rollbackSlots = [...slots];
      rollbackSlots[slotIndex] = targetSlot;
      const rollbackStaff = currentStaff;
      const rollbackRoster = roster;
      const rollbackMetrics = calculateCoverage(rollbackSlots, rollbackRoster);

      set({
        slots: rollbackSlots,
        currentStaff: rollbackStaff,
        roster: rollbackRoster,
        metrics: rollbackMetrics,
        optimisticRollbackCache: null,
        error: 'Failed to persist booking. Please try again.',
      });
      toast.error('Failed to persist shift booking. Rolled back.', 'Storage Error');
      return false;
    }
  },

  releaseShift: async (slotId: string, bookingId: string): Promise<boolean> => {
    const { currentEvent, currentStaff, slots, roster } = get();

    if (!currentEvent) return false;

    const slotIndex = slots.findIndex((s) => s.id === slotId);
    if (slotIndex === -1) return false;

    const targetSlot = slots[slotIndex];
    const targetBooking = targetSlot.bookings.find((b) => b.id === bookingId);
    if (!targetBooking) return false;

    const durationHours =
      (parseTimeToMinutes(targetSlot.endTime) - parseTimeToMinutes(targetSlot.startTime)) / 60;

    // Optimistically remove booking
    const updatedSlot = updateSlotDerivedState({
      ...targetSlot,
      bookings: targetSlot.bookings.filter((b) => b.id !== bookingId),
    });

    const nextSlots = [...slots];
    nextSlots[slotIndex] = updatedSlot;

    // Recalculate roster hours
    const nextRoster = recalculateStaffHours(nextSlots, roster);
    const nextMetrics = calculateCoverage(nextSlots, nextRoster);

    let updatedCurrentStaff = currentStaff;
    if (currentStaff && currentStaff.id === targetBooking.staffId) {
      updatedCurrentStaff = nextRoster.find((m) => m.id === currentStaff.id) || null;
    }

    set({
      slots: nextSlots,
      roster: nextRoster,
      currentStaff: updatedCurrentStaff,
      metrics: nextMetrics,
      error: null,
    });

    try {
      const nextConfig = touchConfig(currentEvent);
      storage.saveEvent({
        config: nextConfig,
        slots: nextSlots,
        roster: nextRoster,
      });
      syncToRemote(nextConfig, nextSlots, nextRoster);
      set({ currentEvent: nextConfig });
      return true;
    } catch (err) {
      console.error('[releaseShift] Failed to persist release:', err);
      return false;
    }
  },

  addRosterMember: (name: string, email?: string) => {
    const { currentEvent, roster, slots } = get();
    if (!currentEvent) {
      throw new Error('No active event loaded.');
    }

    const cleanName = name.trim();
    const cleanEmail = (email || '').trim();

    const newMember: StaffMember = {
      id: `staff_${generateNanoKey()}`,
      eventId: currentEvent.id,
      name: cleanName,
      email: cleanEmail,
      totalBookedHours: 0,
      isConfirmed: false,
    };

    const nextRoster = [...roster, newMember];
    const nextMetrics = calculateCoverage(slots, nextRoster);
    const nextConfig = touchConfig(currentEvent);

    storage.saveEvent({
      config: nextConfig,
      slots,
      roster: nextRoster,
    });
    syncToRemoteAsAdmin(nextConfig, slots, nextRoster);

    set({ currentEvent: nextConfig, roster: nextRoster, metrics: nextMetrics, error: null });
    return newMember;
  },

  removeRosterMember: (staffId: string) => {
    const { currentEvent, roster, slots, currentStaff } = get();
    if (!currentEvent) return;

    // 1. Remove all bookings belonging to this staff member across all slots
    const nextSlots = slots.map((slot) => {
      const hasBooking = slot.bookings.some((b) => b.staffId === staffId);
      if (!hasBooking) return slot;
      return updateSlotDerivedState({
        ...slot,
        bookings: slot.bookings.filter((b) => b.staffId !== staffId),
      });
    });

    // 2. Remove staff from roster
    const nextRoster = roster.filter((m) => m.id !== staffId);
    const nextMetrics = calculateCoverage(nextSlots, nextRoster);

    // 3. Clear currentStaff if it was the removed one
    const updatedStaff = currentStaff?.id === staffId ? null : currentStaff;
    if (currentStaff?.id === staffId) {
      storage.setPersistedStaffId(currentEvent.id, null);
    }

    const nextConfig = touchConfig(currentEvent);
    storage.saveEvent({
      config: nextConfig,
      slots: nextSlots,
      roster: nextRoster,
    });
    syncToRemoteAsAdmin(nextConfig, nextSlots, nextRoster);

    set({
      currentEvent: nextConfig,
      slots: nextSlots,
      roster: nextRoster,
      currentStaff: updatedStaff,
      metrics: nextMetrics,
      error: null,
    });
  },

  updateRosterMember: (staffId: string, updates: { name?: string; email?: string }) => {
    const { currentEvent, roster, slots, currentStaff } = get();
    if (!currentEvent) return;

    const nextName = updates.name?.trim();
    const nextEmail = updates.email !== undefined ? updates.email.trim() : undefined;
    if (nextName !== undefined && !nextName) return; // never allow blanking the name

    const nextRoster = roster.map((m) =>
      m.id === staffId
        ? {
            ...m,
            ...(nextName ? { name: nextName } : {}),
            ...(nextEmail !== undefined ? { email: nextEmail } : {}),
          }
        : m
    );

    // Bookings store their own snapshot of staffName/staffEmail at claim
    // time (so shift tiles don't need to look the roster member up) —
    // keep every existing booking's copy in sync too, or a corrected name
    // would show on the roster but stay stale on every shift tile and any
    // calendar export tied to those bookings.
    const nextSlots = slots.map((slot) => {
      if (!slot.bookings.some((b) => b.staffId === staffId)) return slot;
      return {
        ...slot,
        bookings: slot.bookings.map((b) =>
          b.staffId === staffId
            ? {
                ...b,
                ...(nextName ? { staffName: nextName } : {}),
                ...(nextEmail !== undefined ? { staffEmail: nextEmail } : {}),
              }
            : b
        ),
      };
    });

    const updatedCurrentStaff =
      currentStaff?.id === staffId ? nextRoster.find((m) => m.id === staffId) || currentStaff : currentStaff;

    const nextConfig = touchConfig(currentEvent);
    storage.saveEvent({
      config: nextConfig,
      slots: nextSlots,
      roster: nextRoster,
    });
    syncToRemoteAsAdmin(nextConfig, nextSlots, nextRoster);

    set({
      currentEvent: nextConfig,
      slots: nextSlots,
      roster: nextRoster,
      currentStaff: updatedCurrentStaff,
    });
  },

  updateSlotCapacity: (slotId: string, newCapacity: number) => {
    const { currentEvent, slots, roster } = get();
    if (!currentEvent) return;

    const safeCapacity = Math.max(1, Math.min(10, newCapacity));
    const nextSlots = slots.map((slot) => {
      if (slot.id !== slotId) return slot;
      return updateSlotDerivedState({
        ...slot,
        capacity: safeCapacity,
      });
    });

    const nextMetrics = calculateCoverage(nextSlots, roster);
    const nextConfig = touchConfig(currentEvent);

    storage.saveEvent({
      config: nextConfig,
      slots: nextSlots,
      roster,
    });
    syncToRemoteAsAdmin(nextConfig, nextSlots, roster);

    set({ currentEvent: nextConfig, slots: nextSlots, metrics: nextMetrics });
  },

  updateDefaultSlotCapacity: (newCapacity: number) => {
    const { currentEvent, slots, roster } = get();
    if (!currentEvent) return;

    const safeCapacity = Math.max(1, Math.min(10, newCapacity));
    const nextConfig: EventConfig = {
      ...currentEvent,
      staffCapacityPerSlot: safeCapacity,
      updatedAt: new Date().toISOString(),
    };

    // Apply the new default to every existing slot as well, so the
    // change is reflected immediately across the whole schedule.
    const nextSlots = slots.map((slot) =>
      updateSlotDerivedState({
        ...slot,
        capacity: safeCapacity,
      })
    );

    const nextMetrics = calculateCoverage(nextSlots, roster);

    storage.saveEvent({
      config: nextConfig,
      slots: nextSlots,
      roster,
    });
    syncToRemoteAsAdmin(nextConfig, nextSlots, roster);

    set({ currentEvent: nextConfig, slots: nextSlots, metrics: nextMetrics });
  },

  updateEventTimezone: (newTimezone: string) => {
    const { currentEvent, slots, roster } = get();
    if (!currentEvent || !newTimezone) return;

    // Slot dates/times are stored as local wall-clock strings (e.g. "9:00
    // AM on Oct 14"), independent of timezone — correcting a wrong
    // timezone should fix how those get converted to real UTC moments
    // for calendar exports, without changing the intended local schedule
    // itself. No slot data needs to change here, only the config.
    const nextConfig: EventConfig = {
      ...currentEvent,
      timezone: newTimezone,
      updatedAt: new Date().toISOString(),
    };

    storage.saveEvent({
      config: nextConfig,
      slots,
      roster,
    });
    syncToRemoteAsAdmin(nextConfig, slots, roster);

    set({ currentEvent: nextConfig });
  },

  updateEventDetails: (updates: { title: string; location: string }) => {
    const { currentEvent, slots, roster } = get();
    if (!currentEvent) return;

    const trimmedTitle = updates.title.trim();
    if (!trimmedTitle) return; // never allow blanking the event name

    const nextConfig: EventConfig = {
      ...currentEvent,
      title: trimmedTitle,
      location: updates.location.trim(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveEvent({
      config: nextConfig,
      slots,
      roster,
    });
    syncToRemoteAsAdmin(nextConfig, slots, roster);

    set({ currentEvent: nextConfig });
  },

  adminAssignStaffToSlot: (slotId: string, staff: StaffMember): boolean => {
    const { currentEvent, slots, roster } = get();
    if (!currentEvent) return false;

    const slotIndex = slots.findIndex((s) => s.id === slotId);
    if (slotIndex === -1) return false;

    const slot = slots[slotIndex];

    // Check if slot full
    if (slot.bookings.length >= slot.capacity) {
      set({ error: 'Slot is already at maximum capacity.' });
      return false;
    }

    // Check if already assigned
    if (slot.bookings.some((b) => b.staffId === staff.id)) {
      set({ error: `${staff.name} is already assigned to this slot.` });
      return false;
    }

    const newBooking: ShiftBooking = {
      id: `bk_${generateNanoKey()}`,
      slotId,
      staffId: staff.id,
      staffName: staff.name,
      staffEmail: staff.email,
      bookedAt: new Date().toISOString(),
    };

    const nextSlots = [...slots];
    nextSlots[slotIndex] = updateSlotDerivedState({
      ...slot,
      bookings: [...slot.bookings, newBooking],
    });

    const nextRoster = recalculateStaffHours(nextSlots, roster);
    const nextMetrics = calculateCoverage(nextSlots, nextRoster);
    const nextConfig = touchConfig(currentEvent);

    storage.saveEvent({
      config: nextConfig,
      slots: nextSlots,
      roster: nextRoster,
    });
    syncToRemoteAsAdmin(nextConfig, nextSlots, nextRoster);

    set({ currentEvent: nextConfig, slots: nextSlots, roster: nextRoster, metrics: nextMetrics, error: null });
    return true;
  },

  adminRemoveStaffFromSlot: (slotId: string, staffId: string) => {
    const { currentEvent, slots, roster } = get();
    if (!currentEvent) return;

    const slotIndex = slots.findIndex((s) => s.id === slotId);
    if (slotIndex === -1) return;

    const slot = slots[slotIndex];
    const nextSlots = [...slots];
    nextSlots[slotIndex] = updateSlotDerivedState({
      ...slot,
      bookings: slot.bookings.filter((b) => b.staffId !== staffId),
    });

    const nextRoster = recalculateStaffHours(nextSlots, roster);
    const nextMetrics = calculateCoverage(nextSlots, nextRoster);
    const nextConfig = touchConfig(currentEvent);

    storage.saveEvent({
      config: nextConfig,
      slots: nextSlots,
      roster: nextRoster,
    });
    syncToRemoteAsAdmin(nextConfig, nextSlots, nextRoster);

    set({ currentEvent: nextConfig, slots: nextSlots, roster: nextRoster, metrics: nextMetrics, error: null });
  },

  clearError: () => set({ error: null }),

  resetToDemo: () => {
    const demo = storage.resetToDemo();
    const synchronizedRoster = recalculateStaffHours(demo.slots, demo.roster);
    const normalizedSlots = demo.slots.map(updateSlotDerivedState);
    const metrics = calculateCoverage(normalizedSlots, synchronizedRoster);

    // The demo event is reached via a fixed, well-known key pair from the
    // landing page banner — it must exist in the database like any other
    // event, not just this browser's local cache.
    syncToRemoteAsAdmin(demo.config, normalizedSlots, synchronizedRoster);

    set({
      currentEvent: demo.config,
      slots: normalizedSlots,
      roster: synchronizedRoster,
      currentStaff: synchronizedRoster[0] || null,
      metrics,
      error: null,
      role: 'admin',
    });
  },
}));
