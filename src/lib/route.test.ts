import { describe, it, expect } from 'vitest';
import { hrefs, isAdminOnlyRoute, isExpoFloorRoute, parseRoute } from './route';

describe('parseRoute', () => {
  it('reads every kind of address', () => {
    expect(parseRoute('')).toEqual({ name: 'home' });
    expect(parseRoute('#')).toEqual({ name: 'home' });
    expect(parseRoute('#/')).toEqual({ name: 'home' });
    expect(parseRoute('#/hub/evt_1')).toEqual({ name: 'hub', eventId: 'evt_1' });
    expect(parseRoute('#/hub/evt_1/budget')).toEqual({ name: 'module', eventId: 'evt_1', moduleId: 'budget' });
    expect(parseRoute('#/events')).toEqual({ name: 'events' });
    expect(parseRoute('#/new')).toEqual({ name: 'new' });
    expect(parseRoute('#/users')).toEqual({ name: 'users' });
    expect(parseRoute('#/admin/adm_key')).toEqual({ name: 'admin', adminKey: 'adm_key' });
    expect(parseRoute('#/event/pub_key')).toEqual({ name: 'staff', publicKey: 'pub_key' });
  });

  it('ignores a query string, a trailing slash and the case of the fixed words', () => {
    expect(parseRoute('#/hub/a?x=1')).toEqual({ name: 'hub', eventId: 'a' });
    expect(parseRoute('#/hub/a/?utm=z')).toEqual({ name: 'hub', eventId: 'a' });
    expect(parseRoute('#/new/')).toEqual({ name: 'new' });
    expect(parseRoute('#/new?x=1')).toEqual({ name: 'new' });
    expect(parseRoute('#/EVENTS')).toEqual({ name: 'events' });
    expect(parseRoute('#/Hub/a/Budget')).toEqual({ name: 'module', eventId: 'a', moduleId: 'Budget' });
  });

  it('keeps the case of ids and keys', () => {
    expect(parseRoute('#/hub/Evt_ABC')).toEqual({ name: 'hub', eventId: 'Evt_ABC' });
    expect(parseRoute('#/admin/AbC123')).toEqual({ name: 'admin', adminKey: 'AbC123' });
  });

  it('decodes encoded ids, and survives bad encoding', () => {
    expect(parseRoute('#/hub/a%20b')).toEqual({ name: 'hub', eventId: 'a b' });
    expect(parseRoute('#/hub/%E0%A4%A')).toEqual({ name: 'hub', eventId: '%E0%A4%A' });
  });

  it('a bare "hub" opens the menu, but other incomplete or extra addresses are not found', () => {
    expect(parseRoute('#/hub/')).toEqual({ name: 'home' });
    expect(parseRoute('#/admin')).toEqual({ name: 'notfound' });
    expect(parseRoute('#/admin/')).toEqual({ name: 'notfound' });
    expect(parseRoute('#/event')).toEqual({ name: 'notfound' });
    expect(parseRoute('#/admin/key/extra')).toEqual({ name: 'notfound' });
    expect(parseRoute('#/hub/a/budget/extra')).toEqual({ name: 'notfound' });
    expect(parseRoute('#/events/1')).toEqual({ name: 'notfound' });
    expect(parseRoute('#/users/x')).toEqual({ name: 'notfound' });
    expect(parseRoute('#/unknown')).toEqual({ name: 'notfound' });
  });

  it('treats hostile text as a plain id, never as markup', () => {
    expect(parseRoute('#/hub/<img src=x onerror=alert(1)>')).toEqual({ name: 'hub', eventId: '<img src=x onerror=alert(1)>' });
  });
});

describe('hrefs', () => {
  it('builds addresses that parse back to the same place', () => {
    expect(parseRoute(hrefs.hub('a b/c'))).toEqual({ name: 'hub', eventId: 'a b/c' });
    expect(parseRoute(hrefs.module('evt 1', 'key-stakeholders'))).toEqual({ name: 'module', eventId: 'evt 1', moduleId: 'key-stakeholders' });
    expect(parseRoute(hrefs.admin('k/1'))).toEqual({ name: 'admin', adminKey: 'k/1' });
    expect(parseRoute(hrefs.staff('p?1'))).toEqual({ name: 'staff', publicKey: 'p?1' });
    for (const h of [hrefs.home, hrefs.events, hrefs.new, hrefs.users]) expect(parseRoute(h).name).not.toBe('notfound');
  });
});

describe('which pages are which', () => {
  it('the expo floor is the admin shift matrix and the public staff page', () => {
    expect(isExpoFloorRoute(parseRoute('#/admin/k'))).toBe(true);
    expect(isExpoFloorRoute(parseRoute('#/event/k'))).toBe(true);
    for (const h of ['#/', '#/hub/a', '#/hub/a/budget', '#/events', '#/new', '#/users']) expect(isExpoFloorRoute(parseRoute(h))).toBe(false);
  });

  it('every page except the expo floor and not-found needs an admin, and the staff page is open', () => {
    for (const h of ['#/', '#/hub/a', '#/hub/a/budget', '#/events', '#/new', '#/users']) expect(isAdminOnlyRoute(parseRoute(h))).toBe(true);
    expect(isAdminOnlyRoute(parseRoute('#/event/pub'))).toBe(false);
    expect(isAdminOnlyRoute(parseRoute('#/admin/k'))).toBe(false); // has its own sign-in screen
    expect(isAdminOnlyRoute(parseRoute('#/nope'))).toBe(false);
  });
});
