export type SlotDuration = 30 | 60 | 90 | 120;

export interface EventConfig {
  id: string;
  title: string;
  description: string;
  location: string;
  timezone: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  dailyStartTime: string; // HH:mm
  dailyEndTime: string; // HH:mm
  slotDurationMinutes: SlotDuration;
  staffCapacityPerSlot: number;
  targetHoursPerStaff: number;
  adminKey: string;
  publicKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffMember {
  id: string;
  eventId: string;
  name: string;
  email: string;
  targetHours: number;
  totalBookedHours: number;
  isConfirmed: boolean;
}

export interface ShiftBooking {
  id: string;
  slotId: string;
  staffId: string;
  staffName: string;
  staffEmail: string;
  bookedAt: string; // ISO string
  isOptimistic?: boolean;
}

export interface TimeSlot {
  id: string;
  eventId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  capacity: number;
  bookings: ShiftBooking[];
  isFull: boolean;
  coveragePercentage: number;
}

export interface EventMetrics {
  totalSlots: number;
  totalCapacityHours: number;
  totalBookedHours: number;
  overallCoveragePercent: number;
  unassignedStaffCount: number;
  understaffedSlotCount: number;
  dynamicTargetHours: number;
}

export interface UserSession {
  currentIdentity: StaffMember | null;
  viewMode: 'admin' | 'staff' | 'landing';
  activeKey: string | null;
}

export interface WizardPayload {
  title: string;
  description?: string;
  location?: string;
  timezone?: string;
  startDate: string;
  endDate: string;
  dailyStartTime: string;
  dailyEndTime: string;
  slotDurationMinutes: SlotDuration;
  staffCapacityPerSlot: number;
  targetHoursPerStaff: number;
  rosterNames?: string[];
}

export interface StoredEventData {
  config: EventConfig;
  slots: TimeSlot[];
  roster: StaffMember[];
}
