export * from './useEventStore';
export { useEventStore } from './useEventStore';
import { create } from 'zustand';
import type { EventConfig, EventMetrics, ShiftBooking, StaffMember, TimeSlot, UserSession } from '@/types';
import { calculateCoverage, generateDeterministicSlots, updateSlotDerivedState } from '@/lib/matrix';
import { generateNanoKey } from '@/lib/utils';

interface BoothDutyState {
  config: EventConfig | null;
  slots: TimeSlot[];
  roster: StaffMember[];
  session: UserSession;
  metrics: EventMetrics;

  // Actions
  createNewEvent: (config: EventConfig, initialRosterNames?: string[]) => void;
  initializeEvent: (customConfig?: Partial<EventConfig>) => void;
  updateConfig: (patch: Partial<EventConfig>) => void;
  setSession: (session: Partial<UserSession>) => void;
  addBooking: (slotId: string, member: StaffMember) => boolean;
  removeBooking: (slotId: string, staffId: string) => void;
  addStaffMember: (member: Omit<StaffMember, 'id' | 'totalBookedHours'>) => StaffMember;
  claimIdentity: (name: string, email?: string) => StaffMember;
  resetAll: () => void;
}

const DEFAULT_EVENT_CONFIG: EventConfig = {
  id: 'evt_devcon2026',
  title: 'KubeSummit & CloudNative 2026',
  description: 'Main Exhibition Hall Booth #402. Showcase live demos and distribute swags.',
  location: 'Moscone Center, San Francisco, CA (Booth 402)',
  timezone: 'America/Los_Angeles',
  startDate: '2026-10-14',
  endDate: '2026-10-15',
  dailyStartTime: '09:00',
  dailyEndTime: '17:00',
  slotDurationMinutes: 90,
  staffCapacityPerSlot: 2,
  targetHoursPerStaff: 4.5,
  adminKey: generateNanoKey('adm'),
  publicKey: generateNanoKey('pub'),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const INITIAL_ROSTER: StaffMember[] = [
  {
    id: 'staff_1',
    eventId: DEFAULT_EVENT_CONFIG.id,
    name: 'Alex Rivera',
    email: 'alex@company.io',
    targetHours: 4.5,
    totalBookedHours: 3.0,
    isConfirmed: true,
  },
  {
    id: 'staff_2',
    eventId: DEFAULT_EVENT_CONFIG.id,
    name: 'Elena Rostova',
    email: 'elena@company.io',
    targetHours: 4.5,
    totalBookedHours: 1.5,
    isConfirmed: true,
  },
  {
    id: 'staff_3',
    eventId: DEFAULT_EVENT_CONFIG.id,
    name: 'Marcus Vance',
    email: 'marcus@company.io',
    targetHours: 4.5,
    totalBookedHours: 0,
    isConfirmed: false,
  },
  {
    id: 'staff_4',
    eventId: DEFAULT_EVENT_CONFIG.id,
    name: 'Sarah Chen',
    email: 'sarah@company.io',
    targetHours: 4.5,
    totalBookedHours: 0,
    isConfirmed: true,
  },
];

export const useBoothDutyStore = create<BoothDutyState>((set, get) => {
  const initialSlots = generateDeterministicSlots(DEFAULT_EVENT_CONFIG);

  // Pre-seed a couple bookings for demonstration
  if (initialSlots.length >= 2) {
    const slot0 = initialSlots[0];
    const slot1 = initialSlots[1];

    slot0.bookings.push({
      id: 'b_init_1',
      slotId: slot0.id,
      staffId: INITIAL_ROSTER[0].id,
      staffName: INITIAL_ROSTER[0].name,
      staffEmail: INITIAL_ROSTER[0].email,
      bookedAt: new Date().toISOString(),
    });
    slot0.bookings.push({
      id: 'b_init_2',
      slotId: slot0.id,
      staffId: INITIAL_ROSTER[1].id,
      staffName: INITIAL_ROSTER[1].name,
      staffEmail: INITIAL_ROSTER[1].email,
      bookedAt: new Date().toISOString(),
    });
    initialSlots[0] = updateSlotDerivedState(slot0);

    slot1.bookings.push({
      id: 'b_init_3',
      slotId: slot1.id,
      staffId: INITIAL_ROSTER[0].id,
      staffName: INITIAL_ROSTER[0].name,
      staffEmail: INITIAL_ROSTER[0].email,
      bookedAt: new Date().toISOString(),
    });
    initialSlots[1] = updateSlotDerivedState(slot1);
  }

  const initialMetrics = calculateCoverage(initialSlots, INITIAL_ROSTER);

  return {
    config: DEFAULT_EVENT_CONFIG,
    slots: initialSlots,
    roster: INITIAL_ROSTER,
    session: {
      currentIdentity: INITIAL_ROSTER[0],
      viewMode: 'admin',
      activeKey: DEFAULT_EVENT_CONFIG.adminKey,
    },
    metrics: initialMetrics,

    createNewEvent: (newConfig, initialRosterNames = []) => {
      const parsedRoster: StaffMember[] = initialRosterNames
        .map((raw) => raw.trim())
        .filter(Boolean)
        .map((name, idx) => ({
          id: `staff_${generateNanoKey()}_${idx}`,
          eventId: newConfig.id,
          name,
          email: `${name.toLowerCase().replace(/\s+/g, '.')}@booth.team`,
          targetHours: newConfig.targetHoursPerStaff,
          totalBookedHours: 0,
          isConfirmed: false,
        }));

      const newSlots = generateDeterministicSlots(newConfig);
      const metrics = calculateCoverage(newSlots, parsedRoster);

      set({
        config: newConfig,
        slots: newSlots,
        roster: parsedRoster,
        session: {
          currentIdentity: parsedRoster[0] || null,
          viewMode: 'admin',
          activeKey: newConfig.adminKey,
        },
        metrics,
      });
    },

    initializeEvent: (customConfig) => {
      const mergedConfig: EventConfig = {
        ...DEFAULT_EVENT_CONFIG,
        ...customConfig,
        adminKey: customConfig?.adminKey || generateNanoKey('adm'),
        publicKey: customConfig?.publicKey || generateNanoKey('pub'),
        updatedAt: new Date().toISOString(),
      };
      const newSlots = generateDeterministicSlots(mergedConfig);
      const metrics = calculateCoverage(newSlots, get().roster);
      set({
        config: mergedConfig,
        slots: newSlots,
        metrics,
      });
    },

    updateConfig: (patch) => {
      const current = get().config;
      if (!current) return;
      const updated: EventConfig = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      // Regenerate slots if time range, duration or capacity changes
      const shouldRegenerateSlots =
        patch.startDate !== undefined ||
        patch.endDate !== undefined ||
        patch.dailyStartTime !== undefined ||
        patch.dailyEndTime !== undefined ||
        patch.slotDurationMinutes !== undefined ||
        patch.staffCapacityPerSlot !== undefined;

      const newSlots = shouldRegenerateSlots
        ? generateDeterministicSlots(updated)
        : get().slots;
      const metrics = calculateCoverage(newSlots, get().roster);

      set({
        config: updated,
        slots: newSlots,
        metrics,
      });
    },

    setSession: (patch) => {
      set((state) => ({
        session: { ...state.session, ...patch },
      }));
    },

    addBooking: (slotId, member) => {
      const { slots, roster, config } = get();
      const targetSlot = slots.find((s) => s.id === slotId);
      if (!targetSlot) return false;

      // Prevent duplicate booking in same slot
      if (targetSlot.bookings.some((b) => b.staffId === member.id)) {
        return false;
      }

      // Check slot capacity
      if (targetSlot.bookings.length >= targetSlot.capacity) {
        return false;
      }

      const newBooking: ShiftBooking = {
        id: `b_${generateNanoKey()}`,
        slotId,
        staffId: member.id,
        staffName: member.name,
        staffEmail: member.email,
        bookedAt: new Date().toISOString(),
      };

      const updatedSlots = slots.map((s) => {
        if (s.id !== slotId) return s;
        return updateSlotDerivedState({
          ...s,
          bookings: [...s.bookings, newBooking],
        });
      });

      const slotHours = (config?.slotDurationMinutes || 90) / 60;
      const updatedRoster = roster.map((m) => {
        if (m.id !== member.id) return m;
        return {
          ...m,
          totalBookedHours: Math.round((m.totalBookedHours + slotHours) * 10) / 10,
        };
      });

      const metrics = calculateCoverage(updatedSlots, updatedRoster);
      set({
        slots: updatedSlots,
        roster: updatedRoster,
        metrics,
      });
      return true;
    },

    removeBooking: (slotId, staffId) => {
      const { slots, roster, config } = get();
      const updatedSlots = slots.map((s) => {
        if (s.id !== slotId) return s;
        return updateSlotDerivedState({
          ...s,
          bookings: s.bookings.filter((b) => b.staffId !== staffId),
        });
      });

      const slotHours = (config?.slotDurationMinutes || 90) / 60;
      const updatedRoster = roster.map((m) => {
        if (m.id !== staffId) return m;
        return {
          ...m,
          totalBookedHours: Math.max(0, Math.round((m.totalBookedHours - slotHours) * 10) / 10),
        };
      });

      const metrics = calculateCoverage(updatedSlots, updatedRoster);
      set({
        slots: updatedSlots,
        roster: updatedRoster,
        metrics,
      });
    },

    addStaffMember: (memberData) => {
      const newMember: StaffMember = {
        ...memberData,
        id: `staff_${generateNanoKey()}`,
        totalBookedHours: 0,
      };
      const updatedRoster = [...get().roster, newMember];
      const metrics = calculateCoverage(get().slots, updatedRoster);
      set({
        roster: updatedRoster,
        metrics,
      });
      return newMember;
    },

    claimIdentity: (name: string, email?: string) => {
      const { roster, config } = get();
      const trimmedName = name.trim();
      const trimmedEmail = (email || `${trimmedName.toLowerCase().replace(/\s+/g, '.')}@booth.team`).trim();

      // Check if already in roster
      const existing = roster.find(
        (m) =>
          m.name.toLowerCase() === trimmedName.toLowerCase() ||
          (email && m.email.toLowerCase() === trimmedEmail.toLowerCase())
      );

      if (existing) {
        set((state) => ({
          session: {
            ...state.session,
            currentIdentity: existing,
          },
        }));
        return existing;
      }

      // Add to roster
      const newMember: StaffMember = {
        id: `staff_${generateNanoKey()}`,
        eventId: config?.id || 'event',
        name: trimmedName,
        email: trimmedEmail,
        targetHours: config?.targetHoursPerStaff || 4,
        totalBookedHours: 0,
        isConfirmed: true,
      };

      const updatedRoster = [...roster, newMember];
      const metrics = calculateCoverage(get().slots, updatedRoster);

      set((state) => ({
        roster: updatedRoster,
        metrics,
        session: {
          ...state.session,
          currentIdentity: newMember,
        },
      }));

      return newMember;
    },

    resetAll: () => {
      const slots = generateDeterministicSlots(DEFAULT_EVENT_CONFIG);
      const metrics = calculateCoverage(slots, INITIAL_ROSTER);
      set({
        config: DEFAULT_EVENT_CONFIG,
        slots,
        roster: INITIAL_ROSTER,
        metrics,
      });
    },
  };
});
