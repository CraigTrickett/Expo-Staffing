// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/firebase', async (orig) => (await import('@/test/harness')).firebaseMock(await orig()));

import App from '@/App';
import { EVENTS_TIMEOUT_MS } from './useEvents';
import { fb, makeEvent, resetDom } from '@/test/harness';

beforeEach(() => {
  resetDom();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const open = (hash: string) => {
  window.location.hash = hash;
  render(<App />);
};

describe('when the events cannot be loaded', () => {
  it('the menu says so, rather than "No events yet", and offers a retry that works', async () => {
    const u = userEvent.setup();
    fb.fetchError = true;
    open('#/');
    expect(await screen.findByRole('heading', { name: 'Cannot reach the database' })).toBeTruthy();
    expect(screen.queryByText('No events yet')).toBeNull();
    expect(screen.queryByRole('link', { name: /New event/ })).toBeNull(); // no invitation to create a duplicate
    fb.fetchError = false;
    fb.events = [makeEvent('a', 'Alpha Summit')];
    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' })).toBeTruthy();
  });

  it('an event address says the database is unreachable, not that the event was deleted', async () => {
    fb.fetchError = true;
    open('#/hub/a');
    expect(await screen.findByRole('heading', { name: 'Cannot reach the database' })).toBeTruthy();
    expect(screen.queryByText(/could not be found/)).toBeNull();
  });

  it('an area address says the same', async () => {
    fb.fetchError = true;
    open('#/hub/a/budget');
    expect(await screen.findByRole('heading', { name: 'Cannot reach the database' })).toBeTruthy();
  });

  it('a truly empty database still says there are no events, and offers to create one', async () => {
    open('#/');
    expect(await screen.findByRole('heading', { name: 'No events yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /New event/ }).getAttribute('href')).toBe('#/new');
  });

  it('a request that never answers gives up after the time limit, instead of spinning for ever', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fb.fetchHang = true;
    open('#/');
    expect(document.querySelector('.animate-spin')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(EVENTS_TIMEOUT_MS + 100);
    });
    expect(await screen.findByRole('heading', { name: 'Cannot reach the database' })).toBeTruthy();
    expect(document.querySelector('.animate-spin')).toBeNull();
  });

  it('the Events page says it could not load them, with a retry, and no "Create event locally"', async () => {
    fb.fetchError = true;
    open('#/events');
    expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText(/Create event locally/)).toBeNull();
  });

  it('events saved on this device still show, with a notice, when the database cannot be reached', async () => {
    const local = makeEvent('loc', 'Saved Here');
    localStorage.setItem('boothduty_events_v1', JSON.stringify({ loc: { config: local, slots: [], roster: [] } }));
    fb.fetchError = true;
    open('#/events');
    expect(await screen.findByRole('heading', { name: 'Saved Here' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/Could not reach the database. These are the events saved on this device/);
  });
});
