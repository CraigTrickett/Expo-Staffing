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

const KEYNOTE_STORAGE_PREFIX = 'boothduty_keynotes_';

export function getKeynoteSessions(eventId: string): KeynoteSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${KEYNOTE_STORAGE_PREFIX}${eventId}`);
    if (raw) {
      return JSON.parse(raw);
    }
    const stored = storage.getById(eventId);
    if (stored?.keynoteSessions && stored.keynoteSessions.length > 0) {
      localStorage.setItem(`${KEYNOTE_STORAGE_PREFIX}${eventId}`, JSON.stringify(stored.keynoteSessions));
      return stored.keynoteSessions;
    }

    const initial = createDefaultKeynoteSessions(eventId, stored?.config?.startDate);
    localStorage.setItem(`${KEYNOTE_STORAGE_PREFIX}${eventId}`, JSON.stringify(initial));
    return initial;
  } catch (err) {
    console.warn('[keynote] Failed to get keynote sessions:', err);
    return [];
  }
}

export function saveKeynoteSessions(eventId: string, sessions: KeynoteSession[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${KEYNOTE_STORAGE_PREFIX}${eventId}`, JSON.stringify(sessions));
    const stored = storage.getById(eventId);
    if (stored) {
      stored.keynoteSessions = sessions;
      storage.saveEvent(stored);
    }
  } catch (err) {
    console.warn('[keynote] Failed to save keynote sessions:', err);
  }
}

export function createKeynoteSession(
  eventId: string,
  params: {
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    stageOrRoom: string;
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

export function recalculateSegmentTimes(session: KeynoteSession): KeynoteSession {
  let currentTime = session.startTime || '09:00';
  const updatedSegments = session.segments.map((seg, idx) => {
    const start = currentTime;
    const end = addMinutesToTime(start, seg.durationMinutes || 5);
    currentTime = end;
    return {
      ...seg,
      order: idx + 1,
      time: `${start} - ${end}`,
    };
  });

  return {
    ...session,
    segments: updatedSegments,
  };
}

export function generateKeynoteMarkdown(
  session: KeynoteSession,
  stakeholders: KeyStakeholder[] = []
): string {
  const speakerNameMap = new Map<string, string>();
  stakeholders.forEach((s) => {
    speakerNameMap.set(s.id, `${s.firstName} ${s.lastName}`.trim());
  });

  const lines: string[] = [];
  lines.push(`# ${session.title}`);
  lines.push(`- **Date & Time:** ${session.date || 'TBD'} | ${session.startTime} – ${session.endTime}`);
  lines.push(`- **Stage / Room:** ${session.stageOrRoom || 'Mainstage'}`);
  lines.push(`- **Production Stage:** ${formatStageLabel(session.currentStage)}`);

  if (session.slideDeckUrl) {
    lines.push(`- **Slide Deck Master:** [${session.slideDeckUrl}](${session.slideDeckUrl})`);
  } else {
    lines.push(`- **Slide Deck Master:** *Pending Stage 2 Preparation*`);
  }

  if (session.stage1Narrative.themeStatement) {
    lines.push(`- **Narrative Theme:** ${session.stage1Narrative.themeStatement}`);
  }
  if (session.stage1Narrative.coreMessage) {
    lines.push(`- **Core Message:** ${session.stage1Narrative.coreMessage}`);
  }
  if (session.stage1Narrative.flowHandoverNotes) {
    lines.push(`- **Flow & Connecting Graphics:** ${session.stage1Narrative.flowHandoverNotes}`);
  }
  if (session.stage1Narrative.customerInvolvementNotes) {
    lines.push(`- **Customer / Client Involvement:** ${session.stage1Narrative.customerInvolvementNotes}`);
  }

  if (session.weeklyMeeting.enabled) {
    lines.push(`- **Weekly Progress Sync:** ${session.weeklyMeeting.dayOfWeek} at ${session.weeklyMeeting.time} ${session.weeklyMeeting.meetingUrl ? `([Link](${session.weeklyMeeting.meetingUrl}))` : ''}`);
  }

  if (session.rehearsals.length > 0) {
    const rehearsalSummary = session.rehearsals
      .map((r) => `${r.title} (${r.targetDate} - ${r.isCompleted ? '✓ Done' : 'Pending'})`)
      .join('; ');
    lines.push(`- **Rehearsal Milestones:** ${rehearsalSummary}`);
  }

  if (session.signedOffBy) {
    lines.push(`- **Sign-Off:** Approved by **${session.signedOffBy}** on ${session.signedOffAt || 'N/A'}`);
  }

  lines.push('');
  lines.push('## Run of Show');
  lines.push('');
  lines.push('| Time | Duration | Speaker(s) | Topic / Segment | Handover / Transition | Slide / Deck Link | Stage Cues & AV Notes |');
  lines.push('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

  for (const seg of session.segments) {
    const resolvedSpeakers =
      seg.speakerIds && seg.speakerIds.length > 0
        ? seg.speakerIds.map((id) => speakerNameMap.get(id) || id).join(', ')
        : seg.speakerNames || 'TBD';

    const deckLink = seg.slideDeckLink ? `[Slides](${seg.slideDeckLink})` : (session.slideDeckUrl ? `[Master Deck](${session.slideDeckUrl})` : '—');
    const handover = seg.handoverNotes ? escapePipes(seg.handoverNotes) : '—';
    const cues = seg.cueNotes ? escapePipes(seg.cueNotes) : '—';
    const topic = escapePipes(seg.topic || 'Untitled Segment');
    const speaker = escapePipes(resolvedSpeakers);

    lines.push(`| ${seg.time} | ${seg.durationMinutes} min | ${speaker} | ${topic} | ${handover} | ${deckLink} | ${cues} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Generated from Expo Staffing Production Hub on ${new Date().toLocaleDateString()}*`);

  return lines.join('\n');
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

function escapePipes(str: string): string {
  return str.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function formatStageLabel(stage: KeynoteStage): string {
  switch (stage) {
    case 'develop_run_of_show':
      return 'Stage 1: Develop Run of Show';
    case 'slide_deck_prep':
      return 'Stage 2: Slide Deck Preparation & Rehearsals';
    case 'signed_off':
      return 'Stage 3: Signed Off & Locked';
    default:
      return stage;
  }
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

function createDefaultKeynoteSessions(eventId: string, eventStartDate?: string): KeynoteSession[] {
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
