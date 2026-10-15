import type { StakeholderRef } from './stakeholderRef';

/** A way a room can be set up: Theatre, Classroom, Boardroom and so on. Shared by every room. */
export interface ScheduleLayout {
  id: string;
  name: string;
}

/**
 * A physical room. `capacities` is the layouts this room offers and how many people each seats:
 * a layout with no entry is not available in the room.
 */
export interface ScheduleRoom {
  id: string;
  name: string;
  notes?: string;
  capacities: Record<string, number>;
}

/**
 * Two or more adjacent rooms opened up as one (an airwall). It has its own layouts and
 * capacities, because a joined room is rarely the sum of its parts. Booking it blocks
 * every room in it.
 */
export interface ScheduleCombination {
  id: string;
  roomIds: string[];
  /** Blank uses the room names, such as "Murano 3202, 3203, 3204". */
  name?: string;
  capacities: Record<string, number>;
}

/** Whether a session is Trimble's own or from a customer or partner. Always shown in words as well as colour. */
export type SessionOrigin = 'internal' | 'external';

export interface ScheduleSession {
  id: string;
  /** A short reference such as D-1805. Shown before the title. */
  code?: string;
  title: string;
  abstract?: string;
  /** A link to the presentation. Never a file: nothing is uploaded. */
  presentationUrl?: string;
  origin: SessionOrigin;
  /** The key stakeholders who present the session or are responsible for it. */
  speakers: StakeholderRef[];
  /** Presenters who are not key stakeholders, such as a customer's engineer and their company. */
  guests?: string;
  /** Product or track labels, such as Field Systems or SketchUp. */
  tags: string[];
  /** Fixed in place: it cannot be dragged, and it may run through breaks. */
  fixed?: boolean;
  durationMinutes: number;
  /** A room or a combination. A session with a space but no time waits in that room's tray. */
  spaceId?: string;
  /** Overrides the room's setup for the day. Usually left empty. */
  layoutId?: string;
  expectedAttendance?: number;
  /** YYYY-MM-DD. With startTime, the session is on the agenda. */
  date?: string;
  startTime?: string;
}

export interface ScheduleSettings {
  /**
   * The hours the agenda covers, HH:MM. Left empty, they come from the event's own daily hours.
   * Set only to schedule outside them.
   */
  dayStart?: string;
  dayEnd?: string;
  /** Where there are no session slots, dropped sessions snap to this many minutes. */
  slotMinutes: number;
}

/**
 * One stretch of a day. A slot is where sessions go. A break (including lunch) and an
 * event (an all-attendee keynote, an expo reception) run across every room, and no
 * session can be placed in them.
 */
export type BlockKind = 'slot' | 'break' | 'event';

export interface TimeBlock {
  id: string;
  kind: BlockKind;
  label: string;
  start: string;
  end: string;
}

export interface ScheduleData {
  layouts: ScheduleLayout[];
  rooms: ScheduleRoom[];
  combinations: ScheduleCombination[];
  sessions: ScheduleSession[];
  settings: ScheduleSettings;
  /** The structure of each day, keyed by YYYY-MM-DD. */
  dayBlocks: Record<string, TimeBlock[]>;
  /**
   * How each room is set up on each day, keyed by date then by room or joined-room id.
   * A room is normally in one layout all day, so sessions take their layout from here.
   */
  daySetups: Record<string, Record<string, string>>;
}

/** A bookable thing: one room, or a joined set of rooms. */
export interface Space {
  id: string;
  name: string;
  roomIds: string[];
  kind: 'room' | 'combination';
  capacities: Record<string, number>;
}

/** A keynote or general session placed in a room, read from the Keynote module. */
export interface KeynoteBlock {
  id: string;
  title: string;
  spaceId: string;
  /** YYYY-MM-DD */
  date: string;
  startTime: string;
  endTime: string;
  /** When each speaker is on stage, from the run of show. */
  speakerWindows: { speakerId: string; speakerName: string; start: string; end: string }[];
}
