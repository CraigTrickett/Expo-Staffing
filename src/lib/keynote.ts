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

  lines.push('## Run of Show');
  lines.push('');
  lines.push('| Time | Duration | Speaker(s) | Topic / Segment | Slide / Deck Link | Handover / Transition | Stage Cues & AV Notes |');
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

    lines.push(`| ${seg.time} | ${seg.durationMinutes} min | ${speaker} | ${topic} | ${deckLink} | ${handover} | ${cues} |`);
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

export function escapeHtml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateKeynoteHtml(
  session: KeynoteSession,
  stakeholders: KeyStakeholder[] = []
): string {
  const speakerNameMap = new Map<string, string>();
  stakeholders.forEach((s) => {
    speakerNameMap.set(s.id, `${s.firstName} ${s.lastName}`.trim());
  });

  const rows = session.segments
    .map((seg, idx) => {
      const resolvedSpeakers =
        seg.speakerIds && seg.speakerIds.length > 0
          ? seg.speakerIds.map((id) => speakerNameMap.get(id) || id).join(', ')
          : seg.speakerNames || 'TBD';

      const deckLinkHtml = seg.slideDeckLink
        ? `<a href="${escapeHtml(seg.slideDeckLink)}" style="color: #0063a3; text-decoration: underline;" target="_blank">Slide Link</a>`
        : session.slideDeckUrl
          ? `<a href="${escapeHtml(session.slideDeckUrl)}" style="color: #0063a3; text-decoration: underline;" target="_blank">Master Deck</a>`
          : '—';

      const bg = idx % 2 === 0 ? '#ffffff' : '#f8f9fa';

      return `
      <tr style="background-color: ${bg};">
        <td style="padding: 10px 12px; border: 1px solid #d8dce0; font-family: monospace; font-weight: bold; text-align: center; font-size: 13px;">${idx + 1}</td>
        <td style="padding: 10px 12px; border: 1px solid #d8dce0; font-family: monospace; font-size: 13px; font-weight: 600; white-space: nowrap;">${escapeHtml(seg.time)}</td>
        <td style="padding: 10px 12px; border: 1px solid #d8dce0; font-size: 13px; font-weight: 500; white-space: nowrap;">${seg.durationMinutes} min</td>
        <td style="padding: 10px 12px; border: 1px solid #d8dce0; font-size: 13px; font-weight: 600; color: #252a2e;">${escapeHtml(resolvedSpeakers)}</td>
        <td style="padding: 10px 12px; border: 1px solid #d8dce0; font-size: 13px; color: #252a2e;">${escapeHtml(seg.topic || 'Untitled Segment')}</td>
        <td style="padding: 10px 12px; border: 1px solid #d8dce0; font-size: 12px; color: #0063a3;">${deckLinkHtml}</td>
        <td style="padding: 10px 12px; border: 1px solid #d8dce0; font-size: 12px; color: #46535e;">${escapeHtml(seg.handoverNotes || '—')}</td>
        <td style="padding: 10px 12px; border: 1px solid #d8dce0; font-size: 12px; color: #46535e;">${escapeHtml(seg.cueNotes || '—')}</td>
      </tr>`;
    })
    .join('');

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #252a2e; line-height: 1.5; max-width: 900px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #004f83; font-size: 24px; margin-bottom: 6px; border-bottom: 2px solid #004f83; padding-bottom: 8px;">${escapeHtml(session.title)}</h1>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold; width: 140px; color: #46535e;">Date & Time:</td>
          <td style="padding: 4px 8px;">${escapeHtml(session.date || 'TBD')} &bull; ${escapeHtml(session.startTime)} – ${escapeHtml(session.endTime)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold; color: #46535e;">Location / Stage:</td>
          <td style="padding: 4px 8px;">${escapeHtml(session.stageOrRoom || 'Mainstage')}</td>
        </tr>
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold; color: #46535e;">Production Stage:</td>
          <td style="padding: 4px 8px; font-weight: 600; color: #0063a3;">${formatStageLabel(session.currentStage)}</td>
        </tr>
        ${session.slideDeckUrl ? `
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold; color: #46535e;">Master Slide Deck:</td>
          <td style="padding: 4px 8px;"><a href="${escapeHtml(session.slideDeckUrl)}" style="color: #0063a3;" target="_blank">${escapeHtml(session.slideDeckUrl)}</a></td>
        </tr>` : ''}
        ${session.stage1Narrative.themeStatement ? `
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold; color: #46535e;">Narrative Theme:</td>
          <td style="padding: 4px 8px;">${escapeHtml(session.stage1Narrative.themeStatement)}</td>
        </tr>` : ''}
        ${session.stage1Narrative.coreMessage ? `
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold; color: #46535e;">Core Message:</td>
          <td style="padding: 4px 8px;">${escapeHtml(session.stage1Narrative.coreMessage)}</td>
        </tr>` : ''}
        ${session.stage1Narrative.flowHandoverNotes ? `
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold; color: #46535e;">Section Transitions:</td>
          <td style="padding: 4px 8px;">${escapeHtml(session.stage1Narrative.flowHandoverNotes)}</td>
        </tr>` : ''}
        ${session.stage1Narrative.customerInvolvementNotes ? `
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold; color: #46535e;">Customer Involvement:</td>
          <td style="padding: 4px 8px;">${escapeHtml(session.stage1Narrative.customerInvolvementNotes)}</td>
        </tr>` : ''}
        ${session.signedOffBy ? `
        <tr>
          <td style="padding: 4px 8px 4px 0; font-weight: bold; color: #059669;">Production Sign-Off:</td>
          <td style="padding: 4px 8px; font-weight: bold; color: #059669;">Approved by ${escapeHtml(session.signedOffBy)} on ${escapeHtml(session.signedOffAt || 'N/A')}</td>
        </tr>` : ''}
      </table>

      <h2 style="color: #252a2e; font-size: 18px; margin-top: 24px; margin-bottom: 12px;">Run of Show Sequence</h2>

      <table style="width: 100%; border-collapse: collapse; border: 1px solid #d8dce0; font-size: 13px;">
        <thead>
          <tr style="background-color: #004f83; color: #ffffff;">
            <th style="padding: 10px 12px; border: 1px solid #003d66; text-align: center; width: 40px; font-size: 12px;">#</th>
            <th style="padding: 10px 12px; border: 1px solid #003d66; text-align: left; width: 110px; font-size: 12px;">Time</th>
            <th style="padding: 10px 12px; border: 1px solid #003d66; text-align: left; width: 75px; font-size: 12px;">Duration</th>
            <th style="padding: 10px 12px; border: 1px solid #003d66; text-align: left; font-size: 12px;">Speaker(s)</th>
            <th style="padding: 10px 12px; border: 1px solid #003d66; text-align: left; font-size: 12px;">Topic / Segment</th>
            <th style="padding: 10px 12px; border: 1px solid #003d66; text-align: left; font-size: 12px;">Slide Link</th>
            <th style="padding: 10px 12px; border: 1px solid #003d66; text-align: left; font-size: 12px;">Handover / Transition</th>
            <th style="padding: 10px 12px; border: 1px solid #003d66; text-align: left; font-size: 12px;">Stage Cues & AV Notes</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <p style="margin-top: 20px; font-size: 11px; color: #7c878e; font-style: italic;">
        Generated from Expo Staffing Production Hub on ${new Date().toLocaleDateString()}
      </p>
    </div>
  `;
}

export async function copyFormattedForGoogleDocs(
  session: KeynoteSession,
  stakeholders: KeyStakeholder[] = []
): Promise<boolean> {
  const html = generateKeynoteHtml(session, stakeholders);
  const plainText = generateKeynoteMarkdown(session, stakeholders);

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([plainText], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];
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
