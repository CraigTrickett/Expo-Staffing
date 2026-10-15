import type { KeynoteSession, KeyStakeholder, StoredEventData } from '@/types';
import type { ModuleAttentionItem, ModuleSummary } from '@/types/moduleSummary';
import type { BudgetData } from '@/types/budget';
import type { EssentialsData } from '@/types/essentials';
import type { OtherData } from '@/types/other';
import type { Task, TasksData } from '@/types/tasks';
import { budgetSummary, normaliseBudget } from './budget';
import { createEmptyEssentials, getEssentials, normaliseEssentials, ESSENTIALS_MODULE_ID } from './essentials';
import { describeTimingStatus, getKeynoteSessions, sessionWindowMinutes, timingStatus, totalSegmentMinutes } from './keynote';
import { calculateCoverage } from './matrix';
import { normaliseOther, OTHER_DATA_MODULE_ID } from './other';
import { readModuleLocal } from './moduleStore';
import { getStakeholders } from './stakeholders';
import { storage } from './storage';
import { createEmptyResources, normaliseResources, resourcesSummary, RESOURCES_MODULE_ID } from './resources';
import type { ResourcesData } from '@/types/resources';
import { createEmptySchedule, keynoteBlocks, normaliseSchedule, scheduleSummary, SCHEDULE_MODULE_ID } from './schedule';
import type { ScheduleData } from '@/types/schedule';
import { OTHER_MODULE_ID, TASKS_MODULE_ID, normaliseTasks, taskStats, tasksForModule, todayIso } from './tasks';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ */
/* Pure builders                                                       */
/* ------------------------------------------------------------------ */

/** Any module without a bespoke screen reports from its tasks, contact and links. */
export function genericSummary(
  moduleId: string,
  tasks: Task[],
  essentials: EssentialsData,
  today: string = todayIso()
): ModuleSummary {
  const mine = tasksForModule(tasks, moduleId);
  const { links, contact } = getEssentials(essentials, moduleId);
  if (mine.length === 0 && links.length === 0 && !contact) {
    return { moduleId, state: 'not_started', headline: 'Not started', attention: [] };
  }

  const stats = taskStats(mine, today);
  const parts: string[] = [];
  if (stats.open > 0) parts.push(plural(stats.open, 'open task', 'open tasks'));
  else if (mine.length > 0) parts.push('All tasks done');
  if (contact) parts.push(`Contact: ${contact.name}`);
  if (links.length > 0) parts.push(plural(links.length, 'link', 'links'));

  const attention: ModuleAttentionItem[] = [];
  if (stats.overdue > 0) {
    attention.push({ label: `${plural(stats.overdue, 'task is', 'tasks are')} overdue`, severity: 'warning' });
  }
  return {
    moduleId,
    state: attention.length > 0 ? 'needs_attention' : 'in_progress',
    headline: parts.join(' \u00b7 '),
    attention,
  };
}

export function otherSummary(tasks: Task[], other: OtherData, today: string = todayIso()): ModuleSummary {
  const mine = tasksForModule(tasks, OTHER_MODULE_ID);
  const stats = taskStats(mine, today);
  if (mine.length === 0 && other.notes.length === 0 && other.links.length === 0) {
    return { moduleId: 'other', state: 'not_started', headline: 'Nothing added yet', attention: [] };
  }
  const parts: string[] = [];
  if (mine.length > 0) parts.push(stats.open > 0 ? plural(stats.open, 'open task', 'open tasks') : 'All tasks done');
  if (other.notes.length > 0) parts.push(plural(other.notes.length, 'note', 'notes'));
  if (other.links.length > 0) parts.push(plural(other.links.length, 'link', 'links'));
  const attention: ModuleAttentionItem[] =
    stats.overdue > 0 ? [{ label: `${plural(stats.overdue, 'task is', 'tasks are')} overdue`, severity: 'warning' }] : [];
  return {
    moduleId: 'other',
    state: attention.length > 0 ? 'needs_attention' : 'in_progress',
    headline: parts.join(' \u00b7 '),
    attention,
  };
}

export function keynoteSummary(sessions: KeynoteSession[]): ModuleSummary {
  if (sessions.length === 0) {
    return { moduleId: 'keynote-general-session', state: 'not_started', headline: 'No sessions yet', attention: [] };
  }
  const attention: ModuleAttentionItem[] = [];
  for (const s of sessions) {
    if (s.segments.length === 0) {
      attention.push({ label: `"${s.title}" has no run of show segments`, severity: 'warning' });
      continue;
    }
    const status = timingStatus(totalSegmentMinutes(s.segments), sessionWindowMinutes(s.startTime, s.endTime));
    if (status.kind === 'over') {
      attention.push({ label: `"${s.title}" is ${describeTimingStatus(status)} its slot`, severity: 'critical' });
    }
  }
  const signedOff = sessions.filter((s) => s.currentStage === 'signed_off').length;
  const headline = `${plural(sessions.length, 'session', 'sessions')}, ${signedOff} signed off`;
  const state = attention.length > 0 ? 'needs_attention' : signedOff === sessions.length ? 'complete' : 'in_progress';
  return { moduleId: 'keynote-general-session', state, headline, attention };
}

export function stakeholdersSummary(list: KeyStakeholder[]): ModuleSummary {
  if (list.length === 0) {
    return { moduleId: 'key-stakeholders', state: 'not_started', headline: 'No key stakeholders yet', attention: [] };
  }
  const noEmail = list.filter((s) => !s.email?.trim()).length;
  const attention: ModuleAttentionItem[] =
    noEmail > 0 ? [{ label: `${plural(noEmail, 'stakeholder has', 'stakeholders have')} no email address`, severity: 'warning' }] : [];
  return {
    moduleId: 'key-stakeholders',
    state: attention.length > 0 ? 'needs_attention' : 'in_progress',
    headline: plural(list.length, 'key stakeholder', 'key stakeholders'),
    attention,
  };
}

const daysUntil = (startDate: string, now: Date): number => {
  const [y, m, d] = startDate.split('-').map(Number);
  const start = Date.UTC(y, (m || 1) - 1, d || 1);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((start - today) / 86400000);
};

/** Booths are urgent only when unstaffed shifts meet an event that is close. */
export const BOOTH_URGENCY_DAYS = 14;

export function boothsSummary(stored: StoredEventData | null, now: Date = new Date()): ModuleSummary {
  if (!stored || stored.slots.length === 0) {
    return { moduleId: 'expo-booths', state: 'not_started', headline: 'No shifts set up', attention: [] };
  }
  const metrics = calculateCoverage(stored.slots, stored.roster);
  const unstaffed = stored.slots.filter((s) => s.bookings.length === 0).length;
  const days = daysUntil(stored.config.startDate, now);
  const attention: ModuleAttentionItem[] = [];
  if (unstaffed > 0 && days >= 0 && days <= BOOTH_URGENCY_DAYS) {
    attention.push({
      label: `${plural(unstaffed, 'shift has', 'shifts have')} nobody booked, with the event ${plural(days, 'day', 'days')} away`,
      severity: 'critical',
    });
  }
  const headline = `${Math.round(metrics.overallCoveragePercent)}% of booth hours covered (${metrics.totalBookedHours} of ${metrics.totalCapacityHours} h)`;
  const state = attention.length > 0 ? 'needs_attention' : metrics.overallCoveragePercent >= 100 ? 'complete' : 'in_progress';
  return { moduleId: 'expo-booths', state, headline, attention };
}

/* ------------------------------------------------------------------ */
/* Registry                                                            */
/* ------------------------------------------------------------------ */

interface SummaryContext {
  eventId: string;
  now: Date;
  tasks: Task[];
  essentials: EssentialsData;
}

/**
 * Each module with its own screen registers how it reports. Anything not listed
 * falls back to the generic summary built from its tasks, contact and links.
 */
const MODULE_SUMMARIES: Record<string, (ctx: SummaryContext) => ModuleSummary> = {
  budget: ({ eventId }) => budgetSummary(normaliseBudget(readModuleLocal<BudgetData>(eventId, 'budget')?.data)),
  'key-stakeholders': ({ eventId }) => stakeholdersSummary(getStakeholders(eventId)),
  'keynote-general-session': ({ eventId }) => keynoteSummary(getKeynoteSessions(eventId)),
  resources: ({ eventId }) =>
    resourcesSummary(
      normaliseResources(readModuleLocal<ResourcesData>(eventId, RESOURCES_MODULE_ID)?.data ?? createEmptyResources()),
      getStakeholders(eventId)
    ),
  schedule: ({ eventId }) =>
    scheduleSummary(
      normaliseSchedule(readModuleLocal<ScheduleData>(eventId, SCHEDULE_MODULE_ID)?.data ?? createEmptySchedule()),
      { keynotes: keynoteBlocks(getKeynoteSessions(eventId), getStakeholders(eventId)) }
    ),
  'expo-booths': ({ eventId, now }) => boothsSummary(storage.getById(eventId), now),
  other: ({ eventId, tasks }) =>
    otherSummary(tasks, normaliseOther(readModuleLocal<OtherData>(eventId, OTHER_DATA_MODULE_ID)?.data)),
};

export function getModuleSummary(moduleId: string, eventId: string, now: Date = new Date()): ModuleSummary {
  const tasks = normaliseTasks(readModuleLocal<TasksData>(eventId, TASKS_MODULE_ID)?.data).tasks;
  const essentials = normaliseEssentials(
    readModuleLocal<EssentialsData>(eventId, ESSENTIALS_MODULE_ID)?.data ?? createEmptyEssentials()
  );
  const ctx: SummaryContext = { eventId, now, tasks, essentials };
  const build = MODULE_SUMMARIES[moduleId];
  return build ? build(ctx) : genericSummary(moduleId, tasks, essentials, todayIso(now));
}
