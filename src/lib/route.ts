/**
 * Every address in the app, in one place. Anything that links somewhere builds its address here,
 * and App reads the current one with parseRoute, so the two cannot drift apart.
 */
export type Route =
  /** The menu for the event used last. Where the app opens. */
  | { name: 'home' }
  | { name: 'hub'; eventId: string }
  /** One area of an event, as its own page. */
  | { name: 'module'; eventId: string; moduleId: string }
  | { name: 'users' }
  | { name: 'events' }
  | { name: 'new' }
  | { name: 'admin'; adminKey: string }
  | { name: 'staff'; publicKey: string }
  | { name: 'notfound' };

const decode = (part: string): string => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
};

/**
 * Reads an address such as "#/hub/evt_1/budget". A query string, a trailing slash and the case of the
 * fixed words (events, new, ...) make no difference. Event ids and keys keep their case.
 */
export function parseRoute(hash: string): Route {
  const path = (hash || '').replace(/^#/, '').split('?')[0];
  const parts = path.split('/').filter(Boolean).map(decode);
  if (parts.length === 0) return { name: 'home' };

  const [first, a, b, ...rest] = parts;
  const word = first.toLowerCase();

  if (rest.length > 0) return { name: 'notfound' };

  switch (word) {
    case 'hub':
      if (a === undefined) return { name: 'home' };
      return b === undefined ? { name: 'hub', eventId: a } : { name: 'module', eventId: a, moduleId: b };
    case 'events':
      return a === undefined ? { name: 'events' } : { name: 'notfound' };
    case 'new':
      return a === undefined ? { name: 'new' } : { name: 'notfound' };
    case 'users':
      return a === undefined ? { name: 'users' } : { name: 'notfound' };
    case 'admin':
      return a !== undefined && b === undefined ? { name: 'admin', adminKey: a } : { name: 'notfound' };
    case 'event':
      return a !== undefined && b === undefined ? { name: 'staff', publicKey: a } : { name: 'notfound' };
    default:
      return { name: 'notfound' };
  }
}

const enc = encodeURIComponent;

export const hrefs = {
  home: '#/',
  events: '#/events',
  new: '#/new',
  users: '#/users',
  hub: (eventId: string) => `#/hub/${enc(eventId)}`,
  module: (eventId: string, moduleId: string) => `#/hub/${enc(eventId)}/${enc(moduleId)}`,
  admin: (adminKey: string) => `#/admin/${enc(adminKey)}`,
  staff: (publicKey: string) => `#/event/${enc(publicKey)}`,
};

/** The pages that make up the expo floor: the shift matrix for admins and the public staff sign-up. */
export const isExpoFloorRoute = (route: Route): boolean => route.name === 'admin' || route.name === 'staff';

/** Pages only a signed-in admin may see. The expo floor staff page is not one of them: it is open to anyone with its link. */
export const isAdminOnlyRoute = (route: Route): boolean =>
  route.name === 'home' || route.name === 'hub' || route.name === 'module' || route.name === 'users' || route.name === 'events' || route.name === 'new';
