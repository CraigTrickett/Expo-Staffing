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
  adminKey: string;
  publicKey: string;
  createdAt: string;
  updatedAt: string;
  // Client-visible connection status only — the actual OAuth refresh
  // token is never sent to the browser; it lives in a Cloud Function's
  // own restricted Firestore collection.
  googleCalendarConnected?: boolean;
}

export interface StaffMember {
  id: string;
  eventId: string;
  name: string;
  email: string;
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
  // Set by the onEventWrite Cloud Function once it successfully creates a
  // Google Calendar event for this booking; used to cancel that event if
  // the booking is later released. Never set by the client directly.
  googleCalendarEventId?: string;
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
  rosterNames?: string[];
}

export interface StoredEventData {
  config: EventConfig;
  slots: TimeSlot[];
  roster: StaffMember[];
}
