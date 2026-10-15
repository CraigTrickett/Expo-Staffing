// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/lib/firebase', async (orig) => (await import('@/test/harness')).firebaseMock(await orig()));

import App from '@/App';
import { ADMIN_MODULES } from '@/data/adminModules';
import { fb, makeEvent, resetDom } from '@/test/harness';

beforeEach(() => {
  resetDom();
  fb.events = [makeEvent('a', 'Alpha Summit')];
});
afterEach(() => cleanup());

const open = async (hash: string, ready: () => Promise<unknown>) => {
  window.location.hash = hash;
  render(<App />);
  await ready();
};
const backdrop = () => document.querySelector('[data-testid="app-backdrop"]');

describe('the shared page background', () => {
  it('is behind the menu, with its grid and rings, hidden from assistive technology', async () => {
    await open('#/hub/a', () => screen.findByRole('heading', { level: 1, name: 'Alpha Summit' }));
    const b = backdrop()!;
    expect(b).toBeTruthy();
    expect(b.getAttribute('aria-hidden')).toBe('true');
    expect(b.querySelectorAll('circle')).toHaveLength(9);
    expect(b.querySelector('svg')!.getAttribute('focusable')).toBe('false');
  });

  it('is behind every area page too, not just the menu', async () => {
    for (const m of ADMIN_MODULES.filter((x) => x.id !== 'expo-booths')) {
      await open(`#/hub/a/${m.id}`, () => screen.findByRole('heading', { level: 1 }, { timeout: 15000 }));
      expect(backdrop(), m.id).toBeTruthy();
      cleanup();
    }
  }, 120000);

  it('is behind the Events, User Manager, create and sign-in pages, and the expo floor', async () => {
    for (const [hash, heading] of [['#/events', 'Events'], ['#/users', 'User manager'], ['#/new', 'Create Expo Schedule'], ['#/unknown', 'Page not found']] as const) {
      await open(hash, () => screen.findByRole('heading', { level: 1, name: heading }));
      expect(backdrop(), hash).toBeTruthy();
      cleanup();
    }
    fb.admin = null;
    await open('#/', () => screen.findByRole('heading', { name: 'Admin Sign In' }));
    expect(backdrop()).toBeTruthy();
    cleanup();
    fb.admin = 'craig_trickett@trimble.com';
    await open('#/admin/adm_a', () => screen.findByRole('link', { name: 'Admin' }));
    expect(backdrop()).toBeTruthy();
  });

  it('is not behind the public staff page, which stays plain for use on a phone', async () => {
    fb.admin = null;
    await open('#/event/pub_a', () => screen.findByRole('link', { name: 'Staff' }));
    expect(backdrop()).toBeNull();
  });

  it('sits behind the content and never catches a click', async () => {
    await open('#/hub/a', () => screen.findByRole('heading', { level: 1, name: 'Alpha Summit' }));
    const root = backdrop()!.parentElement!;
    expect(root.className).toMatch(/\bisolate\b/); // its own stacking context, so the backdrop stays behind the content
    expect(root.className).not.toMatch(/bg-\[#f1f3f6\]/); // otherwise the page colour would cover it
  });
});
