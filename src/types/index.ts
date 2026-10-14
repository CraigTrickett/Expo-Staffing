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

export interface KeyStakeholder {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  email: string;
  team: string;
  involvedWith: string[];
  phone?: string;
  notes?: string;
  createdAt: string;
}

export type KeynoteStage = 'develop_run_of_show' | 'slide_deck_prep' | 'signed_off';

export interface Stage1NarrativeConfig {
  confirmedNarrative: boolean;
  themeStatement: string;
  coreMessage: string;
  flowHandoverNotes: string;
  hasConnectingGraphics: boolean;
  customerInvolvementNotes: string;
  customerCompanies: string[];
}

export interface WeeklyMeetingConfig {
  enabled: boolean;
  dayOfWeek: string;
  time: string;
  meetingUrl?: string;
  notes?: string;
}

export interface RehearsalItem {
  id: string;
  title: string;
  targetDate: string;
  time: string;
  locationOrUrl: string;
  isCompleted: boolean;
  notes?: string;
}

export interface RunOfShowSegment {
  id: string;
  order: number;
  time: string;
  durationMinutes: number;
  topic: string;
  speakerIds: string[];
  speakerNames: string;
  handoverNotes?: string;
  slideDeckLink?: string;
  cueNotes?: string;
}

export interface KeynoteSession {
  id: string;
  eventId: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  stageOrRoom: string;
  currentStage: KeynoteStage;
  slideDeckUrl?: string;
  assignedSpeakerIds: string[];
  stage1Narrative: Stage1NarrativeConfig;
  weeklyMeeting: WeeklyMeetingConfig;
  rehearsals: RehearsalItem[];
  segments: RunOfShowSegment[];
  signedOffBy?: string;
  signedOffAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredEventData {
  config: EventConfig;
  slots: TimeSlot[];
  roster: StaffMember[];
  stakeholders?: KeyStakeholder[];
  keynoteSessions?: KeynoteSession[];
}

