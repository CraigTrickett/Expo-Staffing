import type { KeynoteSession } from '@/types';
import type { BudgetData } from '@/types/budget';
import { getKeynoteSessions } from './keynote';
import { normaliseBudget } from './budget';
import { readModuleLocal } from './moduleStore';
import type { ScheduleData } from '@/types/schedule';
import type { ResourcesData } from '@/types/resources';
import { normaliseSchedule } from './schedule';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Where a stakeholder is referred to, as short readable phrases, one per module.
 * Pure so it can be tested; usesOfStakeholder below gathers the real data.
 */
export function describeUses(
  stakeholderId: string,
  keynoteSessions: KeynoteSession[],
  budget: BudgetData | null,
  schedule: ScheduleData | null = null,
  resources: ResourcesData | null = null
): string[] {
  const uses: string[] = [];

  const speaking = keynoteSessions.reduce(
    (n, s) => n + s.segments.filter((seg) => seg.speakerIds?.includes(stakeholderId)).length,
    0
  );
  if (speaking > 0) uses.push(`Keynote: speaker in ${plural(speaking, 'segment', 'segments')}`);

  if (budget) {
    const authorised = budget.approvals.filter((a) => a.authorisedBy.id === stakeholderId).length;
    const owned = budget.lines.filter((l) => l.owner?.id === stakeholderId).length;
    const parts: string[] = [];
    if (authorised > 0) parts.push(`authorised ${plural(authorised, 'budget version', 'budget versions')}`);
    if (owned > 0) parts.push(`owns ${plural(owned, 'cost line', 'cost lines')}`);
    if (parts.length > 0) uses.push(`Budget: ${parts.join(', ')}`);
  }

  if (schedule) {
    const speaking = schedule.sessions.filter((x) => x.speakers.some((sp) => sp.id === stakeholderId)).length;
    if (speaking > 0) uses.push(`Schedule: speaker in ${plural(speaking, 'session', 'sessions')}`);
  }

  if (resources) {
    const owned = (resources.resources ?? []).filter((r) => r.owner?.id === stakeholderId).length;
    if (owned > 0) uses.push(`Resources: key stakeholder for ${plural(owned, 'resource', 'resources')}`);
  }

  return uses;
}

export function usesOfStakeholder(eventId: string, stakeholderId: string): string[] {
  const budget = readModuleLocal<BudgetData>(eventId, 'budget');
  const schedule = readModuleLocal<ScheduleData>(eventId, 'schedule');
  return describeUses(stakeholderId, getKeynoteSessions(eventId), budget ? normaliseBudget(budget.data) : null, schedule ? normaliseSchedule(schedule.data) : null, readModuleLocal<ResourcesData>(eventId, 'resources')?.data ?? null);
}
