import { describe, it, expect } from 'vitest';
import { boothsSummary, genericSummary, keynoteSummary, otherSummary, stakeholdersSummary } from './moduleSummaries';
import { createTask, toggleTask } from './tasks';
import { addLink, createEmptyEssentials, setContact } from './essentials';
import type { KeynoteSession, KeyStakeholder, StoredEventData, TimeSlot } from '@/types';

const NOW = new Date('2026-10-14T12:00:00');
const sarah = { id: 'stk_sarah', name: 'Sarah Chen' };

describe('genericSummary', () => {
  it('is not started with nothing set', () => {
    expect(genericSummary('swag', [], createEmptyEssentials())).toMatchObject({ state: 'not_started', headline: 'Not started' });
  });

  it('reports tasks, contact and links together', () => {
    let e = createEmptyEssentials();
    const r = addLink(e, 'badging-registration', 'Signup', 'https://docs.google.com/spreadsheets/d/a');
    if (r.ok) e = r.data;
    e = setContact(e, 'badging-registration', sarah);
    const tasks = [createTask({ title: 'a', moduleId: 'badging-registration' }, NOW), createTask({ title: 'b', moduleId: 'swag' }, NOW)];
    const s = genericSummary('badging-registration', tasks, e, '2026-10-14');
    expect(s.headline).toBe('1 open task \u00b7 Contact: Sarah Chen \u00b7 1 link');
    expect(s.state).toBe('in_progress');
  });

  it('needs attention when a task is overdue, and says all done when they are', () => {
    const overdue = createTask({ title: 'a', moduleId: 'swag', dueDate: '2026-10-01' }, NOW);
    const s = genericSummary('swag', [overdue], createEmptyEssentials(), '2026-10-14');
    expect(s).toMatchObject({ state: 'needs_attention', attention: [{ label: '1 task is overdue', severity: 'warning' }] });
    expect(genericSummary('swag', [toggleTask(overdue)], createEmptyEssentials(), '2026-10-14').headline).toBe('All tasks done');
  });
});

describe('otherSummary', () => {
  it('counts tasks, notes and links', () => {
    const tasks = [createTask({ title: 'a', moduleId: 'other' }, NOW)];
    const s = otherSummary(tasks, { notes: [{} as never, {} as never], links: [{} as never] }, '2026-10-14');
    expect(s.headline).toBe('1 open task \u00b7 2 notes \u00b7 1 link');
  });
  it('is not started when empty', () => {
    expect(otherSummary([], { notes: [], links: [] }).state).toBe('not_started');
  });
});

const session = (over: Partial<KeynoteSession>): KeynoteSession =>
  ({ id: 's', title: 'Opening', startTime: '09:00', endTime: '10:00', currentStage: 'develop_run_of_show', segments: [{ durationMinutes: 30 } as never], ...over }) as KeynoteSession;

describe('keynoteSummary', () => {
  it('flags a session that runs over its slot, critically', () => {
    const s = keynoteSummary([session({ segments: [{ durationMinutes: 70 } as never] })]);
    expect(s.state).toBe('needs_attention');
    expect(s.attention[0]).toMatchObject({ severity: 'critical' });
    expect(s.attention[0].label).toMatch(/10 min over its slot/);
  });
  it('flags a session with no segments', () => {
    expect(keynoteSummary([session({ segments: [] })]).attention[0].label).toMatch(/no run of show segments/);
  });
  it('complete only when every session is signed off', () => {
    expect(keynoteSummary([session({ currentStage: 'signed_off' })]).state).toBe('complete');
    expect(keynoteSummary([session({ currentStage: 'signed_off' }), session({})]).state).toBe('in_progress');
    expect(keynoteSummary([]).state).toBe('not_started');
  });
});

describe('stakeholdersSummary', () => {
  const stk = (email: string): KeyStakeholder => ({ id: email, eventId: 'e', firstName: 'A', lastName: 'B', email, team: '', involvedWith: [], createdAt: '' });
  it('counts people and flags missing emails', () => {
    expect(stakeholdersSummary([stk('a@x.com'), stk('')])).toMatchObject({ state: 'needs_attention', headline: '2 key stakeholders' });
    expect(stakeholdersSummary([stk('a@x.com')]).state).toBe('in_progress');
    expect(stakeholdersSummary([]).state).toBe('not_started');
  });
});

describe('boothsSummary', () => {
  const slot = (bookings: number): TimeSlot =>
    ({ id: String(Math.random()), eventId: 'e', date: '2026-11-04', startTime: '09:00', endTime: '10:00', capacity: 1, bookings: Array.from({ length: bookings }, () => ({}) as never), isFull: bookings >= 1, coveragePercentage: bookings * 100 });
  const stored = (slots: TimeSlot[], startDate: string): StoredEventData =>
    ({ config: { startDate } as never, slots, roster: [] });

  it('is not started with no shifts', () => {
    expect(boothsSummary(null, NOW).state).toBe('not_started');
    expect(boothsSummary(stored([], '2026-11-04'), NOW).state).toBe('not_started');
  });
  it('is critical when shifts are unstaffed and the event is close', () => {
    const s = boothsSummary(stored([slot(1), slot(0)], '2026-10-20'), NOW);
    expect(s.state).toBe('needs_attention');
    expect(s.attention[0].label).toMatch(/1 shift has nobody booked, with the event 6 days away/);
  });
  it('is only in progress when unstaffed shifts are still far off', () => {
    expect(boothsSummary(stored([slot(1), slot(0)], '2026-12-20'), NOW).state).toBe('in_progress');
  });
  it('is complete when every shift is covered', () => {
    expect(boothsSummary(stored([slot(1), slot(1)], '2026-12-20'), NOW).state).toBe('complete');
  });
});
