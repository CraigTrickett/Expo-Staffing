// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/firebase', async (orig) => (await import('@/test/harness')).firebaseMock(await orig()));

import App from '@/App';
import { ADMIN_MODULES } from '@/data/adminModules';
import { addBlock, addCombination, addRoom, createEmptySchedule, createSession, fillSlots, setCapacity } from '@/lib/schedule';
import { addSampleKeynoteSessions } from '@/lib/keynote';
import { createResource } from '@/lib/resources';
import { describeViolations, runAxe } from '@/test/axe';
import { fb, makeEvent, resetDom } from '@/test/harness';

beforeEach(() => {
  resetDom();
  fb.events = [makeEvent('a', 'Alpha Summit')];
  localStorage.setItem('boothduty_module_a_stakeholders', JSON.stringify({ updatedAt: '2099-01-01T00:00:00.000Z', data: [{ id: 'stk_1', eventId: 'a', firstName: 'Sarah', lastName: 'Chen', email: 's@x.com', team: 'Executive', involvedWith: ['Budget'], createdAt: '' }] }));
});
afterEach(() => cleanup());

const must = <T,>(r: { ok: boolean; data?: T; error?: string }): T => {
  if (r.ok !== true) throw new Error(r.error);
  return r.data as T;
};
const open = async (hash: string, heading?: string) => {
  window.location.hash = hash;
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 15000 });
};
const expectClean = async (label: string) => {
  const found = await runAxe();
  expect(found, `${label}\n${describeViolations(found)}`).toEqual([]);
};

describe('pages have no accessibility violations', () => {
  it('sign in', async () => {
    fb.admin = null;
    window.location.hash = '#/';
    render(<App />);
    await screen.findByRole('heading', { name: 'Admin Sign In' });
    await expectClean('sign in');
  });
  for (const [hash, title, label] of [['#/hub/a', 'Alpha Summit', 'menu'], ['#/events', 'Events', 'events'], ['#/new', 'Create Expo Schedule', 'create event'], ['#/users', 'User manager', 'user manager'], ['#/unknown', 'Page not found', 'not found']] as const) {
    it(label, async () => {
      await open(hash, title);
      await expectClean(label);
    }, 30000);
  }
});

describe('every area has no violations, empty', () => {
  for (const m of ADMIN_MODULES.filter((x) => x.id !== 'expo-booths')) {
    it(m.title, async () => {
      window.location.hash = `#/hub/a/${m.id}`;
      render(<App />);
      await screen.findByRole('heading', { level: 1 }, { timeout: 15000 });
      await expectClean(m.title);
    }, 40000);
  }
});

describe('areas with data in them', () => {
  const seedSchedule = () => {
    const CTX = { keynotes: [], eventHours: { start: '09:00', end: '17:00' } };
    let d = createEmptySchedule();
    for (const n of ['Murano 3202', 'Murano 3203']) d = must(addRoom(d, n));
    d = must(addCombination(d, [d.rooms[0].id, d.rooms[1].id]));
    d = must(setCapacity(d, d.rooms[0].id, 'layout_theatre', 60));
    d = must(setCapacity(d, d.rooms[1].id, 'layout_theatre', 60));
    d = must(addBlock(d, CTX, '2099-11-09', { kind: 'break', label: 'LUNCH', start: '12:00', end: '13:00' }));
    d = must(fillSlots(d, CTX, '2099-11-09', 60));
    const mk = (title: string, over = {}) => must(createSession({ title, durationMinutes: 60, speakers: [{ id: 'stk_1', name: 'Sarah Chen' }], tags: ['Tekla'], ...over } as never));
    d = { ...d, sessions: [{ ...mk('Internal talk', { code: 'D-1805' }), spaceId: d.rooms[0].id, date: '2099-11-09', startTime: '10:00' }, { ...mk('External talk', { origin: 'external', guests: 'Marcello' }), spaceId: d.rooms[1].id, date: '2099-11-09', startTime: '10:00' }, { ...mk('Fixed', { fixed: true, durationMinutes: 120 }), spaceId: d.rooms[0].id, date: '2099-11-09', startTime: '14:00' }, mk('Waiting')] };
    localStorage.setItem('boothduty_module_a_schedule', JSON.stringify({ data: d, updatedAt: '2099-01-01T00:00:00.000Z' }));
  };

  it('schedule: agenda with sessions, the editor, sessions, rooms and day structure', async () => {
    const u = userEvent.setup();
    seedSchedule();
    await open('#/hub/a/schedule', 'Schedule');
    await expectClean('schedule agenda');
    await u.click(screen.getByRole('button', { name: /^Waiting, internal/ }));
    await expectClean('schedule agenda with editor');
    for (const tab of [/^Sessions/, /Rooms & layouts/, /Day structure/]) {
      await u.click(screen.getByRole('tab', { name: tab }));
      await expectClean(`schedule ${tab}`);
    }
  }, 60000);

  it('keynote with sessions, with the stages expanded', async () => {
    const u = userEvent.setup();
    addSampleKeynoteSessions('a');
    await open('#/hub/a/keynote-general-session', 'Keynote / General Session');
    await expectClean('keynote');
    const page = screen.getByRole('region', { name: /Keynote/ });
    for (const toggle of Array.from(page.querySelectorAll('button[aria-expanded]')).slice(0, 3)) await u.click(toggle as HTMLElement);
    await expectClean('keynote expanded');
  }, 60000);

  it('resources, key stakeholders, budget and other, with something in them', async () => {
    const r = must(createResource({ title: 'Floor plan', url: 'https://example.com/plan', categoryId: 'expo-booths', owner: { id: 'stk_1', name: 'Sarah Chen' } }));
    localStorage.setItem('boothduty_module_a_resources', JSON.stringify({ data: { resources: [r] }, updatedAt: '2099-01-01T00:00:00.000Z' }));
    for (const [id, title] of [['resources', 'Resources'], ['key-stakeholders', 'Key Stakeholders'], ['budget', 'Budget'], ['other', 'Other']] as const) {
      await open(`#/hub/a/${id}`, title);
      await expectClean(title);
      cleanup();
    }
  }, 90000);
});
