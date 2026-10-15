// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from './ErrorBoundary';
import { clearLocalData } from '@/lib/storage';
import { getKeynoteSessions } from '@/lib/keynote';

const Boom: React.FC = () => {
  throw new Error('Something broke');
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('clearLocalData', () => {
  it('removes everything the app keeps on the device, and nothing else', () => {
    for (const k of ['boothduty_events_v1', 'boothduty_module_e1_budget', 'boothduty_keynotes_e1', 'boothduty_identity_e1', 'showrunner_last_event']) localStorage.setItem(k, 'x');
    localStorage.setItem('some_other_site_key', 'keep');
    expect(clearLocalData()).toBe(5);
    expect(Object.keys(localStorage)).toEqual(['some_other_site_key']);
  });
  it('is fine when there is nothing to clear', () => {
    expect(clearLocalData()).toBe(0);
  });
});

describe('the error screen', () => {
  it('says what happened in plain language, with two ways out', () => {
    render(<ErrorBoundary><Boom /></ErrorBoundary>);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Try again, or reload the page.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reset cache/ })).toBeTruthy();
  });

  it('Reset cache clears the device, adds no demo event, goes to the menu and reloads', async () => {
    const u = userEvent.setup();
    const reload = vi.fn();
    localStorage.setItem('boothduty_events_v1', JSON.stringify({ a: { config: { id: 'a' } } }));
    localStorage.setItem('showrunner_last_event', 'a');
    localStorage.setItem('other', 'keep');
    render(<ErrorBoundary onReload={reload}><Boom /></ErrorBoundary>);
    await u.click(screen.getByRole('button', { name: /Reset cache/ }));
    expect(localStorage.getItem('boothduty_events_v1')).toBeNull(); // not replaced by a demo event
    expect(localStorage.getItem('showrunner_last_event')).toBeNull();
    expect(localStorage.getItem('other')).toBe('keep');
    expect(window.location.hash).toBe('#/');
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('Reset cache clears the keynote data whose corruption used to crash the app, so the crash does not come back', async () => {
    const u = userEvent.setup();
    localStorage.setItem('boothduty_module_e1_keynote', '{{{ not json');
    localStorage.setItem('boothduty_keynotes_e1', 'null');
    render(<ErrorBoundary onReload={vi.fn()}><Boom /></ErrorBoundary>);
    await u.click(screen.getByRole('button', { name: /Reset cache/ }));
    expect(getKeynoteSessions('e1')).toEqual([]);
    expect(Object.keys(localStorage).filter((k) => k.includes('keynote'))).toEqual([]);
  });
});
