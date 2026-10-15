import { describe, it, expect } from 'vitest';
import { describeUses } from './references';
import { addApproval, createEmptyBudget } from './budget';
import type { KeynoteSession, RunOfShowSegment } from '@/types';
import type { BudgetData } from '@/types/budget';

const seg = (id: string, speakerIds: string[]): RunOfShowSegment => ({
  id, order: 1, time: '', durationMinutes: 5, topic: id, speakerIds, speakerNames: '',
});
const session = (segments: RunOfShowSegment[]) => ({ segments }) as unknown as KeynoteSession;

const sarah = { id: 'stk_sarah', name: 'Sarah Chen' };
const NOW = new Date('2026-10-14T12:00:00');

function budgetWith(): BudgetData {
  const base = addApproval(createEmptyBudget(), { total: 100, allocations: {}, confirmedOn: '2026-10-01', authorisedBy: sarah }, NOW);
  const v2 = addApproval(base, { total: 200, allocations: {}, confirmedOn: '2026-10-02', authorisedBy: sarah }, NOW);
  return {
    ...v2,
    lines: [
      { id: 'a', categoryId: 'cat_av', description: 'a', forecast: 1, closed: false, createdAt: '', owner: sarah },
      { id: 'b', categoryId: 'cat_av', description: 'b', forecast: 1, closed: false, createdAt: '' },
    ],
  };
}

describe('describeUses', () => {
  it('says nothing for a stakeholder who is not referenced', () => {
    expect(describeUses('stk_x', [session([seg('a', ['stk_sarah'])])], budgetWith())).toEqual([]);
  });

  it('counts keynote segments across sessions', () => {
    const uses = describeUses('stk_sarah', [session([seg('a', ['stk_sarah'])]), session([seg('b', ['stk_sarah']), seg('c', [])])], null);
    expect(uses).toEqual(['Keynote: speaker in 2 segments']);
  });

  it('uses the singular for one', () => {
    expect(describeUses('stk_sarah', [session([seg('a', ['stk_sarah'])])], null)).toEqual(['Keynote: speaker in 1 segment']);
  });

  it('counts scheduled sessions a stakeholder speaks in', () => {
    const sched = { sessions: [{ speakers: [{ id: 'stk_sarah', name: 'S' }] }, { speakers: [] }, { speakers: [{ id: 'stk_sarah', name: 'S' }] }] } as never;
    expect(describeUses('stk_sarah', [], null, sched)).toEqual(['Schedule: speaker in 2 sessions']);
    expect(describeUses('stk_other', [], null, sched)).toEqual([]);
  });

  it('counts the resources a stakeholder is responsible for', () => {
    const res = { resources: [{ owner: { id: 'stk_sarah', name: 'S' } }, { owner: { id: 'stk_other', name: 'O' } }, { owner: { id: 'stk_sarah', name: 'S' } }] } as never;
    expect(describeUses('stk_sarah', [], null, null, res)).toEqual(['Resources: key stakeholder for 2 resources']);
    expect(describeUses('stk_nobody', [], null, null, res)).toEqual([]);
  });

  it('reports budget authorisations and owned lines together', () => {
    expect(describeUses('stk_sarah', [], budgetWith())).toEqual([
      'Budget: authorised 2 budget versions, owns 1 cost line',
    ]);
  });
});
