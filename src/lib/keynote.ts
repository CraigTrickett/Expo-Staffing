import { buildRunOfShowDoc, EMPTY_DOCUMENT_SETTINGS, escapeHtml, renderRunOfShowHtml, renderRunOfShowMarkdown } from './runOfShowDoc';
import type { RunOfShowDocOptions } from './runOfShowDoc';
import type { KeynoteDocumentSettings } from '@/types/keynoteDocument';
import type { Task } from '@/types/tasks';
import type {
  KeynoteSession,
  KeynoteStage,
  RunOfShowSegment,
  KeyStakeholder,
  RehearsalItem,
  Stage1NarrativeConfig,
  WeeklyMeetingConfig,
} from '@/types';
import { generateNanoKey } from './utils';
import { storage } from './storage';
import { readModuleLocal, saveModule, seedModuleLocal } from './moduleStore';

/** Where earlier versions kept keynote sessions: this device only. Read once, to move them to shared storage. */
const LEGACY_KEYNOTE_PREFIX = 'boothduty_keynotes_';
export const KEYNOTE_MODULE_ID = 'keynote';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const STAGES: KeynoteStage[] = ['develop_run_of_show', 'slide_deck_prep', 'signed_off'];

function normaliseSegment(raw: unknown, index: number): RunOfShowSegment | null {
  if (!isRecord(raw)) return null;
  const duration = typeof raw.durationMinutes === 'number' && Number.isFinite(raw.durationMinutes) ? Math.max(0, raw.durationMinutes) : 10;
  return {
    ...(raw as object),
    id: text(raw.id) || `seg_${index}`,
    order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : index + 1,
    time: text(raw.time),
    durationMinutes: duration,
    topic: text(raw.topic),
    speakerIds: list(raw.speakerIds).filter((x): x is string => typeof x === 'string'),
    speakerNames: text(raw.speakerNames),
  } as RunOfShowSegment;
}

/**
 * One keynote session read from storage, with anything missing or the wrong shape filled in, or null
 * if it is not a session at all. Stored data can come from an older version or a partial write, and a
 * screen should never fall over because of it.
 */
export function normaliseKeynoteSession(raw: unknown): KeynoteSession | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  const narrative = isRecord(raw.stage1Narrative) ? raw.stage1Narrative : {};
  const meeting = isRecord(raw.weeklyMeeting) ? raw.weeklyMeeting : {};
  return {
    ...(raw as object),
    id: raw.id,
    eventId: text(raw.eventId),
    title: text(raw.title, 'Untitled session'),
    date: text(raw.date),
    startTime: text(raw.startTime, '09:00'),
    endTime: text(raw.endTime, '10:30'),
    stageOrRoom: text(raw.stageOrRoom),
    currentStage: STAGES.includes(raw.currentStage as KeynoteStage) ? (raw.currentStage as KeynoteStage) : 'develop_run_of_show',
    assignedSpeakerIds: list(raw.assignedSpeakerIds).filter((x): x is string => typeof x === 'string'),
    stage1Narrative: {
      confirmedNarrative: false,
      themeStatement: '',
      coreMessage: '',
      flowHandoverNotes: '',
      hasConnectingGraphics: true,
      customerInvolvementNotes: '',
      ...narrative,
      customerCompanies: list(narrative.customerCompanies).filter((x): x is string => typeof x === 'string'),
    },
    weeklyMeeting: { enabled: true, dayOfWeek: 'Tuesday', time: '', meetingUrl: '', notes: '', ...meeting },
    rehearsals: list(raw.rehearsals).filter(isRecord) as unknown as KeynoteSession['rehearsals'],
    // Positions are counted after any junk has gone, so the fallback order has no gaps.
    segments: list(raw.segments)
      .filter(isRecord)
      .map((seg, i) => normaliseSegment(seg, i))
      .filter((x): x is RunOfShowSegment => x !== null),
    createdAt: text(raw.createdAt),
    updatedAt: text(raw.updatedAt),
  } as KeynoteSession;
}

export function normaliseKeynoteSessions(raw: unknown): KeynoteSession[] {
  return list(raw)
    .map(normaliseKeynoteSession)
    .filter((x): x is KeynoteSession => x !== null);
}

function readLegacyKeynotes(eventId: string): KeynoteSession[] {
  try {
    const raw = localStorage.getItem(`${LEGACY_KEYNOTE_PREFIX}${eventId}`);
    if (raw) {
      const found = normaliseKeynoteSessions(JSON.parse(raw));
      if (found.length > 0) return found;
    }
  } catch {
    /* unreadable: treat as nothing to migrate */
  }
  return normaliseKeynoteSessions(storage.getById(eventId)?.keynoteSessions);
}

/**
 * The event's keynote sessions. They are shared between admins and devices through the module store, so
 * the local copy read here is the latest one that has been brought in (see syncModules). A new event
 * starts with none.
 */
export function getKeynoteSessions(eventId: string): KeynoteSession[] {
  if (typeof window === 'undefined') return [];
  const shared = readModuleLocal<unknown>(eventId, KEYNOTE_MODULE_ID);
  if (shared) return normaliseKeynoteSessions(shared.data);

  // Earlier versions kept these on this device only. Move them across, once.
  const legacy = readLegacyKeynotes(eventId);
  if (legacy.length > 0) {
    seedModuleLocal(eventId, KEYNOTE_MODULE_ID, legacy);
    return legacy;
  }
  return [];
}

/** Adds the sample sessions to an event that has none, and returns the sessions it now has. */
export function addSampleKeynoteSessions(eventId: string): KeynoteSession[] {
  const current = getKeynoteSessions(eventId);
  if (current.length > 0) return current;
  const sample = createSampleKeynoteSessions(eventId, storage.getById(eventId)?.config?.startDate);
  saveKeynoteSessions(eventId, sample);
  return sample;
}

export function saveKeynoteSessions(eventId: string, sessions: KeynoteSession[]): void {
  if (typeof window === 'undefined') return;
  // The working copy is written at once, and the shared copy follows in the background.
  void saveModule(eventId, KEYNOTE_MODULE_ID, sessions);
}

export function createKeynoteSession(
  eventId: string,
  params: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    stageOrRoom: string;
    spaceId?: string;
    slideDeckUrl?: string;
  }
): KeynoteSession {
  const current = getKeynoteSessions(eventId);
  const newSession: KeynoteSession = {
    id: `knt_${generateNanoKey()}`,
    eventId,
    title: params.title.trim(),
    date: params.date,
    startTime: params.startTime || '09:00',
    endTime: params.endTime || '10:30',
    stageOrRoom: params.stageOrRoom.trim() || 'Mainstage Hall A',
    spaceId: params.spaceId,
    currentStage: 'develop_run_of_show',
    slideDeckUrl: params.slideDeckUrl?.trim(),
    assignedSpeakerIds: [],
    stage1Narrative: {
      confirmedNarrative: false,
      themeStatement: '',
      coreMessage: '',
      flowHandoverNotes: '',
      hasConnectingGraphics: true,
      customerInvolvementNotes: '',
      customerCompanies: [],
    },
    weeklyMeeting: {
      enabled: true,
      dayOfWeek: 'Tuesday',
      time: '10:00 AM PT',
      meetingUrl: '',
      notes: 'Weekly progress sync with segment leads and slide designers.',
    },
    rehearsals: [
      {
        id: `reh_${generateNanoKey()}`,
        title: 'Rehearsal 1: Timing & Content Dry Run',
        targetDate: getOffsetDate(params.date, -30),
        time: '14:00',
        locationOrUrl: 'Virtual Rehearsal Studio / Zoom',
        isCompleted: false,
        notes: 'Timing verification on raw spoken content without final slides.',
      },
      {
        id: `reh_${generateNanoKey()}`,
        title: 'Rehearsal 2: Full Slide Deck Walkthrough',
        targetDate: getOffsetDate(params.date, -20),
        time: '14:00',
        locationOrUrl: 'Executive Boardroom / Hybrid',
        isCompleted: false,
        notes: 'Review complete slide transitions, speaker handoffs, and video clips.',
      },
      {
        id: `reh_${generateNanoKey()}`,
        title: 'Rehearsal 3: Technical AV & Stage Mic Check',
        targetDate: getOffsetDate(params.date, -7),
        time: '16:00',
        locationOrUrl: 'Convention Center Mainstage Hall A',
        isCompleted: false,
        notes: 'Final on-site cue check with stage manager, teleprompters, and lighting.',
      },
    ],
    segments: [
      {
        id: `seg_${generateNanoKey()}`,
        order: 1,
        time: `${params.startTime || '09:00'} - ${addMinutesToTime(params.startTime || '09:00', 5)}`,
        durationMinutes: 5,
        topic: 'Executive Welcome & Conference Opening',
        speakerIds: [],
        speakerNames: 'MC / Host',
        handoverNotes: 'Opening video sting into live walk-on from Stage Left',
        cueNotes: 'House lights dim to 20%, spotlight center stage',
      },
      {
        id: `seg_${generateNanoKey()}`,
        order: 2,
        time: `${addMinutesToTime(params.startTime || '09:00', 5)} - ${addMinutesToTime(params.startTime || '09:00', 30)}`,
        durationMinutes: 25,
        topic: 'State of the Industry & Company Vision',
        speakerIds: [],
        speakerNames: 'Executive Speaker',
        handoverNotes: 'Connecting 3D motion graphic bridge into product reveal',
        cueNotes: 'Lapel mic 1, confidence monitor slide + notes feed active',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [...current, newSession];
  saveKeynoteSessions(eventId, updated);
  return newSession;
}

export function updateKeynoteSession(
  eventId: string,
  id: string,
  updates: Partial<KeynoteSession>
): KeynoteSession | null {
  const current = getKeynoteSessions(eventId);
  let updatedSession: KeynoteSession | null = null;

  const next = current.map((session) => {
    if (session.id === id) {
      updatedSession = {
        ...session,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      if (updates.segments || updates.startTime) {
        updatedSession = recalculateSegmentTimes(updatedSession);
      }
      return updatedSession;
    }
    return session;
  });

  if (updatedSession) {
    saveKeynoteSessions(eventId, next);
  }
  return updatedSession;
}

export function deleteKeynoteSession(eventId: string, id: string): boolean {
  const current = getKeynoteSessions(eventId);
  const filtered = current.filter((s) => s.id !== id);
  if (filtered.length !== current.length) {
    saveKeynoteSessions(eventId, filtered);
    return true;
  }
  return false;
}

export function reorderKeynoteSegments(
  session: KeynoteSession,
  segmentId: string,
  direction: 'up' | 'down'
): KeynoteSession {
  const index = session.segments.findIndex((s) => s.id === segmentId);
  if (index === -1) return session;
  if (direction === 'up' && index === 0) return session;
  if (direction === 'down' && index === session.segments.length - 1) return session;

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  const newSegments = [...session.segments];
  const [removed] = newSegments.splice(index, 1);
  newSegments.splice(targetIndex, 0, removed);

  const updatedSession: KeynoteSession = {
    ...session,
    segments: newSegments,
  };

  return recalculateSegmentTimes(updatedSession);
}

export function scheduleSegments(startTime: string, segments: RunOfShowSegment[]): RunOfShowSegment[] {
  let currentTime = startTime || '09:00';
  return segments.map((seg, idx) => {
    const start = currentTime;
    const end = addMinutesToTime(start, seg.durationMinutes || 5);
    currentTime = end;
    return {
      ...seg,
      order: idx + 1,
      time: `${start} - ${end}`,
    };
  });
}

export function recalculateSegmentTimes(session: KeynoteSession): KeynoteSession {
  return {
    ...session,
    segments: scheduleSegments(session.startTime, session.segments),
  };
}

/** Length of the session window in minutes. An end before the start is read as running past midnight. */
export function sessionWindowMinutes(startTime: string, endTime: string): number {
  const diff = timeToMinutes(endTime) - timeToMinutes(startTime);
  return diff > 0 ? diff : diff + 1440;
}

export function totalSegmentMinutes(segments: RunOfShowSegment[]): number {
  return segments.reduce((sum, seg) => sum + (seg.durationMinutes || 5), 0);
}

export type TimingStatus =
  | { kind: 'over'; minutes: number }
  | { kind: 'spare'; minutes: number }
  | { kind: 'exact'; minutes: 0 };

/** How the planned running order compares with the time the session has. */
export function timingStatus(totalMinutes: number, windowMinutes: number): TimingStatus {
  const diff = totalMinutes - windowMinutes;
  if (diff > 0) return { kind: 'over', minutes: diff };
  if (diff < 0) return { kind: 'spare', minutes: -diff };
  return { kind: 'exact', minutes: 0 };
}

export function describeTimingStatus(status: TimingStatus): string {
  if (status.kind === 'over') return `${status.minutes} min over`;
  if (status.kind === 'spare') return `${status.minutes} min spare`;
  return 'fits exactly';
}

/** Move one segment to a new position. Out-of-range or no-op moves return the original array. */
export function moveSegment(segments: RunOfShowSegment[], fromIndex: number, toIndex: number): RunOfShowSegment[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= segments.length ||
    toIndex >= segments.length
  ) {
    return segments;
  }
  const next = [...segments];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Teams behind a segment's speakers, in speaker order and without repeats.
 * Linked stakeholders win. When a segment only carries free-text names
 * ("Craig Trickett & Sarah Chen"), names that match a stakeholder still resolve.
 */
export function resolveSegmentTeams(segment: RunOfShowSegment, stakeholders: KeyStakeholder[]): string[] {
  const teams: string[] = [];
  const add = (team?: string) => {
    const value = team?.trim();
    if (value && !teams.includes(value)) teams.push(value);
  };

  const byId = new Map(stakeholders.map((s) => [s.id, s]));
  for (const id of segment.speakerIds ?? []) add(byId.get(id)?.team);
  if (teams.length > 0) return teams;

  if (segment.speakerNames) {
    const byName = new Map(
      stakeholders.map((s) => [normaliseName(`${s.firstName} ${s.lastName}`), s] as const)
    );
    const parts = segment.speakerNames
      .replace(/\([^)]*\)/g, ' ')
      .split(/&|,|\+|\/|\band\b/i)
      .map(normaliseName)
      .filter(Boolean);
    for (const part of parts) add(byName.get(part)?.team);
  }
  return teams;
}

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function downloadMarkdownFile(filename: string, content: string): void {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface RunOfShowContext {
  eventTitle?: string;
  settings?: KeynoteDocumentSettings;
  /** Tasks tagged to the keynote module; the open ones are printed as "Open Items". */
  openItems?: Task[];
  options?: RunOfShowDocOptions;
}

const asList = (sessions: KeynoteSession | KeynoteSession[]) => (Array.isArray(sessions) ? sessions : [sessions]);

const docFor = (sessions: KeynoteSession | KeynoteSession[], stakeholders: KeyStakeholder[], ctx: RunOfShowContext) =>
  buildRunOfShowDoc({
    eventTitle: ctx.eventTitle ?? '',
    settings: ctx.settings ?? EMPTY_DOCUMENT_SETTINGS,
    sessions: asList(sessions),
    stakeholders,
    openItems: ctx.openItems,
    options: ctx.options,
  });

/** The run of show as Markdown, in the layout of the Developer Summit document. */
export function generateKeynoteMarkdown(
  sessions: KeynoteSession | KeynoteSession[],
  stakeholders: KeyStakeholder[] = [],
  ctx: RunOfShowContext = {}
): string {
  return renderRunOfShowMarkdown(docFor(sessions, stakeholders, ctx));
}

/** The same document as HTML, for the in-app preview and for pasting into Google Docs. */
export function generateKeynoteHtml(
  sessions: KeynoteSession | KeynoteSession[],
  stakeholders: KeyStakeholder[] = [],
  ctx: RunOfShowContext = {}
): string {
  return renderRunOfShowHtml(docFor(sessions, stakeholders, ctx));
}

export async function copyFormattedForGoogleDocs(
  sessions: KeynoteSession | KeynoteSession[],
  stakeholders: KeyStakeholder[] = [],
  ctx: RunOfShowContext = {}
): Promise<boolean> {
  const html = generateKeynoteHtml(sessions, stakeholders, ctx);
  const plainText = generateKeynoteMarkdown(sessions, stakeholders, ctx);

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const data = [
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        }),
      ];
      await navigator.clipboard.write(data);
      return true;
    }
  } catch (err) {
    console.warn('[keynote] ClipboardItem rich-text copy failed, falling back:', err);
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(plainText);
      return true;
    }
  } catch (err) {
    console.error('[keynote] Clipboard copy failed:', err);
  }
  return false;
}

export { escapeHtml };

function escapePipes(str: string): string {
  return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function timeToMinutes(timeStr: string): number {
  const [hStr, mStr] = (timeStr || '0:0').split(':');
  return parseInt(hStr || '0', 10) * 60 + parseInt(mStr || '0', 10);
}

function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const [hStr, mStr] = timeStr.split(':');
  let totalMin = parseInt(hStr || '0', 10) * 60 + parseInt(mStr || '0', 10) + minutesToAdd;
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const newH = Math.floor(totalMin / 60);
  const newM = totalMin % 60;
  return `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;
}

function getOffsetDate(baseDateStr: string, dayOffset: number): string {
  try {
    const base = baseDateStr ? new Date(baseDateStr) : new Date();
    base.setDate(base.getDate() + dayOffset);
    return base.toISOString().split('T')[0];
  } catch {
    const today = new Date();
    today.setDate(today.getDate() + dayOffset);
    return today.toISOString().split('T')[0];
  }
}

/** Made-up sessions for trying the module out. Never added unless asked for. */
export function createSampleKeynoteSessions(eventId: string, eventStartDate?: string): KeynoteSession[] {
  const targetDate = eventStartDate || new Date().toISOString().split('T')[0];
  return [
    {
      id: `knt_opening_2026`,
      eventId,
      title: 'Opening Keynote: Scaling Enterprise Spatial AI',
      date: targetDate,
      startTime: '09:00',
      endTime: '10:30',
      stageOrRoom: 'Mainstage Hall A',
      currentStage: 'develop_run_of_show',
      slideDeckUrl: 'https://docs.google.com/presentation/d/demo-keynote-deck-2026',
      assignedSpeakerIds: ['stk_sarah_chen', 'stk_marcus_vance'],
      stage1Narrative: {
        confirmedNarrative: true,
        themeStatement: 'From Disruption to Practical Spatial Intelligence on the Jobsite and Cloud',
        coreMessage: 'Connecting digital twins, hardware telematics, and automated generative workflows into one cohesive operating system.',
        flowHandoverNotes: 'Connecting 3D motion graphic stinger transitions between executive address and live developer demo.',
        hasConnectingGraphics: true,
        customerInvolvementNotes: 'Acme Infrastructure VP co-presenting 5-minute case study on Stage Right.',
        customerCompanies: ['Acme Infrastructure Corp'],
      },
      weeklyMeeting: {
        enabled: true,
        dayOfWeek: 'Tuesday',
        time: '10:00 AM PT',
        meetingUrl: 'https://meet.google.com/abc-demo-sync',
        notes: 'Weekly progress sync with Sarah Chen, Marcus Vance, and design agency.',
      },
      rehearsals: [
        {
          id: `reh_1`,
          title: 'Rehearsal 1: Timing & Content Dry Run',
          targetDate: getOffsetDate(targetDate, -28),
          time: '10:00',
          locationOrUrl: 'Virtual Studio / Google Meet',
          isCompleted: true,
          notes: 'Spoken pacing verified. Sarah 24 min, Marcus 18 min.',
        },
        {
          id: `reh_2`,
          title: 'Rehearsal 2: Full Slide Deck Walkthrough',
          targetDate: getOffsetDate(targetDate, -14),
          time: '14:00',
          locationOrUrl: 'Executive Briefing Center',
          isCompleted: false,
          notes: 'Integrate final video animations and live device screen mirror.',
        },
        {
          id: `reh_3`,
          title: 'Rehearsal 3: Technical AV & Stage Mic Check',
          targetDate: getOffsetDate(targetDate, -2),
          time: '16:00',
          locationOrUrl: 'Moscone West Mainstage Hall A',
          isCompleted: false,
          notes: 'Full stage run-through with lighting cues and teleprompters.',
        },
      ],
      segments: [
        {
          id: `seg_1`,
          order: 1,
          time: '09:00 - 09:05',
          durationMinutes: 5,
          topic: 'Welcome, Host Remarks & Opening Video',
          speakerIds: [],
          speakerNames: 'Craig Trickett (MC)',
          handoverNotes: 'Opening cinematic video sting into live stage walk-on',
          slideDeckLink: 'https://docs.google.com/presentation/d/demo-keynote-deck-2026#slide=1',
          cueNotes: 'House lights to 10%, audio punch on opening video bumper',
        },
        {
          id: `seg_2`,
          order: 2,
          time: '09:05 - 09:30',
          durationMinutes: 25,
          topic: 'Executive Keynote: The Spatial AI Era',
          speakerIds: ['stk_sarah_chen'],
          speakerNames: 'Sarah Chen',
          handoverNotes: 'Connecting graphic on main LED wall introducing developer live demo',
          slideDeckLink: 'https://docs.google.com/presentation/d/demo-keynote-deck-2026#slide=6',
          cueNotes: 'Lapel mic 1, confidence monitor 1 on speaker notes',
        },
        {
          id: `seg_3`,
          order: 3,
          time: '09:30 - 09:50',
          durationMinutes: 20,
          topic: 'Live Architecture & Platform Demo',
          speakerIds: ['stk_marcus_vance'],
          speakerNames: 'Marcus Vance',
          handoverNotes: 'Handover to customer testimonial spotlight',
          slideDeckLink: 'https://docs.google.com/presentation/d/demo-keynote-deck-2026#slide=28',
          cueNotes: 'Switch stage input to Demo Laptop 1 (HDMI 4K, 60fps)',
        },
        {
          id: `seg_4`,
          order: 4,
          time: '09:50 - 10:05',
          durationMinutes: 15,
          topic: 'Customer Spotlight: Real-World ROI',
          speakerIds: [],
          speakerNames: 'Acme Infrastructure Co-Presenter',
          handoverNotes: 'Host steps back out to center stage for wrap-up',
          slideDeckLink: 'https://docs.google.com/presentation/d/demo-keynote-deck-2026#slide=42',
          cueNotes: 'Handheld mic 2, customer logo on side flanking screens',
        },
        {
          id: `seg_5`,
          order: 5,
          time: '10:05 - 10:15',
          durationMinutes: 10,
          topic: 'Closing Summary & Expo Hall Ribbon Cut',
          speakerIds: [],
          speakerNames: 'Craig Trickett & Sarah Chen',
          handoverNotes: 'Full walk-off music as audience transitions to expo hall',
          slideDeckLink: 'https://docs.google.com/presentation/d/demo-keynote-deck-2026#slide=50',
          cueNotes: 'House lights up to 100%, walk-out track playlist on soundboard',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
