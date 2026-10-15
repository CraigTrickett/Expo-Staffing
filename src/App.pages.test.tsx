// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/firebase', async (orig) => (await import('@/test/harness')).firebaseMock(await orig()));

import App from '@/App';
import { toast } from '@/components/common/Toast';
import { ADMIN_MODULES } from '@/data/adminModules';
import { LAST_EVENT_KEY } from '@/lib/events';
import { card, fb, makeEvent, OWNER, resetDom } from '@/test/harness';

const A = makeEvent('a', 'Alpha Summit', { updatedAt: '2099-05-01T00:00:00.000Z' });
const B = makeEvent('b', 'Beta Summit');

beforeEach(() => {
  resetDom();
  toast.clear();
  fb.events = [A, B];
});
afterEach(() => cleanup());

const open = async (hash: string) => {
  window.location.hash = hash;
  render(<App />);
};
const header = () => screen.getByRole('banner');

describe('opening the app', () => {
  it('lands on the menu for the newest event, as a page', async () => {
    await open('');
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' })).toBeTruthy();
    expect(window.location.hash).toBe('#/hub/a');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens on the event used last, and falls back to the newest when it has gone', async () => {
    localStorage.setItem(LAST_EVENT_KEY, 'b');
    await open('');
    expect(await screen.findByRole('heading', { level: 1, name: 'Beta Summit' })).toBeTruthy();
    cleanup();
    localStorage.setItem(LAST_EVENT_KEY, 'gone');
    await open('');
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' })).toBeTruthy();
  });

  it('is not the create-event page: that is at #/new, behind a New event button', async () => {
    await open('');
    await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' });
    expect(screen.queryByText('Create Expo Schedule')).toBeNull();
    expect(screen.getByRole('link', { name: /New event/ }).getAttribute('href')).toBe('#/new');
    cleanup();
    await open('#/new');
    expect(await screen.findByRole('heading', { level: 1, name: 'Create Expo Schedule' })).toBeTruthy();
  });
});

describe('every area is a page of its own', () => {
  it('each card is a link to #/hub/<event>/<area>, except Expo Booths and User Manager', async () => {
    await open('#/hub/a');
    await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' });
    for (const m of ADMIN_MODULES.filter((x) => x.id !== 'expo-booths')) expect(card(m.title).getAttribute('href')).toBe(`#/hub/a/${m.id}`);
    expect(card('Expo Booths').getAttribute('href')).toBe('#/admin/adm_a');
    expect(card('User Manager').getAttribute('href')).toBe('#/users');
  });

  it('opening one changes the address and shows a page, not a dialog; Back returns to the menu', async () => {
    const u = userEvent.setup();
    await open('#/hub/a');
    await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' });
    await u.click(card('Budget'));
    expect(window.location.hash).toBe('#/hub/a/budget');
    expect(await screen.findByRole('heading', { level: 1, name: 'Budget' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    await u.click(screen.getByRole('button', { name: 'Back to menu' }));
    expect(window.location.hash).toBe('#/hub/a');
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' })).toBeTruthy();
  });

  it('the browser back button works between the menu and an area', async () => {
    const u = userEvent.setup();
    await open('#/hub/a');
    await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' });
    await u.click(card('Resources'));
    await screen.findByRole('heading', { level: 1, name: 'Resources' });
    window.history.back();
    await waitFor(() => expect(window.location.hash).toBe('#/hub/a'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' })).toBeTruthy();
  });

  it('every area can be opened directly from its address, and has a heading and a way back', async () => {
    for (const m of ADMIN_MODULES.filter((x) => x.id !== 'expo-booths')) {
      await open(`#/hub/a/${m.id}`);
      // Each page's code loads the first time it is opened, which is slower under test than in a browser.
      const h1 = await screen.findByRole('heading', { level: 1 }, { timeout: 15000 });
      expect(h1.textContent, m.id).toContain(m.id === 'keynote-general-session' ? 'Keynote' : m.title.split(' ')[0]);
      expect(screen.queryByRole('dialog'), m.id).toBeNull();
      expect(screen.getAllByRole('button', { name: 'Back to menu' }).length, m.id).toBeGreaterThan(0);
      cleanup();
    }
  }, 120000);

  it('Expo Booths goes to the expo floor, also from an area address', async () => {
    await open('#/hub/a/expo-booths');
    await waitFor(() => expect(window.location.hash).toBe('#/admin/adm_a'));
  });

  it('an unknown area or event says so', async () => {
    await open('#/hub/a/not-an-area');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
    cleanup();
    await open('#/hub/gone/budget');
    expect(await screen.findByText(/event could not be found/)).toBeTruthy();
  });

  it('User Manager is a page of its own, with a way back', async () => {
    const u = userEvent.setup();
    await open('#/hub/a');
    await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' });
    await u.click(card('User Manager'));
    expect(window.location.hash).toBe('#/users');
    expect(await screen.findByRole('heading', { level: 1, name: 'User manager' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to menu' }).getAttribute('href')).toBe('#/');
  });
});

describe('the header', () => {
  it('has a burger to the left of Showrunner, and no "Menu" text', async () => {
    await open('#/hub/a');
    await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' });
    const burger = within(header()).getByRole('link', { name: 'Menu' });
    const brand = within(header()).getByRole('link', { name: 'Showrunner' });
    expect(burger.getAttribute('href')).toBe('#/');
    expect(burger.textContent).toBe('');
    expect(burger.querySelector('svg')).toBeTruthy();
    expect(burger.compareDocumentPosition(brand) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(header()).queryByText('Menu')).toBeNull();
    expect(burger.getAttribute('aria-current')).toBe('page');
  });

  it('shows Admin and Staff only on the expo floor', async () => {
    for (const hash of ['#/hub/a', '#/hub/a/budget', '#/events', '#/users', '#/new']) {
      await open(hash);
      await screen.findByRole('banner');
      await waitFor(() => expect(within(header()).getByRole('link', { name: 'Menu' })).toBeTruthy());
      expect(within(header()).queryByRole('link', { name: 'Admin' }), hash).toBeNull();
      expect(within(header()).queryByRole('link', { name: 'Staff' }), hash).toBeNull();
      cleanup();
    }
    await open('#/admin/adm_a');
    expect(await within(header()).findByRole('link', { name: 'Admin' })).toBeTruthy();
    expect(within(header()).getByRole('link', { name: 'Staff' }).getAttribute('href')).toBe('#/event/pub_a');
  });

  it('on the staff page, signed in, an admin sees Admin and Staff; the public sees only Staff and no menu', async () => {
    await open('#/event/pub_a');
    expect(await within(header()).findByRole('link', { name: 'Staff' })).toBeTruthy();
    expect(within(header()).getByRole('link', { name: 'Admin' })).toBeTruthy();
    cleanup();
    fb.admin = null;
    await open('#/event/pub_a');
    expect(await within(header()).findByRole('link', { name: 'Staff' })).toBeTruthy();
    expect(within(header()).queryByRole('link', { name: 'Admin' })).toBeNull();
    expect(within(header()).queryByRole('link', { name: 'Menu' })).toBeNull();
    expect(within(header()).queryByRole('link', { name: /Events/ })).toBeNull();
  });

  it('keeps Events, and marks the current page', async () => {
    await open('#/events');
    await screen.findByRole('heading', { level: 1, name: 'Events' });
    expect(within(header()).getByRole('link', { name: /Events/ }).getAttribute('aria-current')).toBe('page');
    expect(within(header()).getByRole('link', { name: 'Menu' }).getAttribute('aria-current')).toBeNull();
  });

  it('the profile menu no longer holds User manager, only signing out', async () => {
    const u = userEvent.setup();
    await open('#/hub/a');
    await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' });
    await u.click(within(header()).getByRole('button', { name: /Account menu/ }));
    const items = screen.getAllByRole('menuitem').map((i) => i.textContent?.trim());
    expect(items).toEqual(['Log out']);
  });
});

describe('the staff page stays open to anyone with the link', () => {
  it('signed out, the staff address opens with no sign-in, while every menu page asks for one', async () => {
    fb.admin = null;
    await open('#/event/pub_a');
    expect(await within(header()).findByRole('link', { name: 'Staff' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Admin Sign In' })).toBeNull();
    cleanup();
    for (const hash of ['#/', '#/hub/a', '#/hub/a/budget', '#/users', '#/events', '#/new']) {
      await open(hash);
      expect(await screen.findByRole('heading', { name: 'Admin Sign In' }), hash).toBeTruthy();
      cleanup();
    }
  });
});

describe('not-found and odd addresses', () => {
  it('an unknown address says so rather than silently going home', async () => {
    await open('#/unknown');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Go to the menu' }).getAttribute('href')).toBe('#/');
  });

  it('a query string or trailing slash on a good address still works', async () => {
    await open('#/hub/a?utm=x');
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' })).toBeTruthy();
    cleanup();
    await open('#/new/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Create Expo Schedule' })).toBeTruthy();
    cleanup();
    await open('#/EVENTS');
    expect(await screen.findByRole('heading', { level: 1, name: 'Events' })).toBeTruthy();
  });

  it('hostile text in the address is shown as text, never run', async () => {
    await open('#/hub/<img src=x onerror=alert(1)>');
    expect(await screen.findByRole('heading', { name: 'That event could not be found' })).toBeTruthy();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});
