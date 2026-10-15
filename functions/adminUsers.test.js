import { describe, it, expect, beforeEach } from 'vitest';
import adminUsersModule from './adminUsers.js';

const { createAdminUserService, ServiceError } = adminUsersModule;

const OWNERS = ['owner@example.com', 'Second.Owner@Example.com'];
const NOW = new Date('2026-10-14T12:00:00.000Z');

function fakeDb(initial = {}) {
  const docs = new Map(Object.entries(initial));
  return {
    docs,
    collection: () => ({
      doc: (id) => ({
        get: async () => ({ exists: docs.has(id), data: () => docs.get(id) }),
        set: async (value) => void docs.set(id, value),
        delete: async () => void docs.delete(id),
      }),
      get: async () => ({ forEach: (fn) => docs.forEach((data, id) => fn({ id, data: () => data })) }),
    }),
  };
}

function fakeAuth(existing = []) {
  const users = new Map(existing.map((e, i) => [e, { uid: `uid${i}`, email: e }]));
  const revoked = [];
  return {
    users,
    revoked,
    getUserByEmail: async (email) => {
      if (!users.has(email)) throw Object.assign(new Error('nope'), { code: 'auth/user-not-found' });
      return users.get(email);
    },
    createUser: async ({ email }) => {
      users.set(email, { uid: `new_${email}`, email });
      return users.get(email);
    },
    revokeRefreshTokens: async (uid) => void revoked.push(uid),
  };
}

let db, auth, svc;
beforeEach(() => {
  db = fakeDb();
  auth = fakeAuth();
  svc = createAdminUserService({ db, auth, owners: OWNERS, now: () => NOW });
});

const rejects = async (promise, code) => {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(ServiceError);
    expect(err.code).toBe(code);
    return;
  }
  throw new Error('expected a rejection');
};

describe('isAdmin', () => {
  it('owners are always admins, whatever the case', async () => {
    expect(await svc.isAdmin('OWNER@example.com')).toBe(true);
    expect(await svc.isAdmin('second.owner@example.com')).toBe(true);
  });
  it('a granted admin is an admin, and a stranger is not', async () => {
    db.docs.set('friend@example.com', { email: 'friend@example.com' });
    expect(await svc.isAdmin('Friend@Example.com')).toBe(true);
    expect(await svc.isAdmin('stranger@example.com')).toBe(false);
  });
  it('an empty or missing email is never an admin', async () => {
    expect(await svc.isAdmin('')).toBe(false);
    expect(await svc.isAdmin(undefined)).toBe(false);
  });
});

describe('grant', () => {
  it('creates the account if it does not exist, says so, and records who granted it and when', async () => {
    const r = await svc.grant('owner@example.com', '  New.Person@Example.com ');
    expect(r).toEqual({ email: 'new.person@example.com', alreadyAdmin: false, accountCreated: true });
    expect(auth.users.has('new.person@example.com')).toBe(true);
    expect(db.docs.get('new.person@example.com')).toEqual({
      email: 'new.person@example.com',
      addedBy: 'owner@example.com',
      addedAt: NOW.toISOString(),
    });
    expect(await svc.isAdmin('new.person@example.com')).toBe(true);
  });

  it('does not create a second account for someone who already has one', async () => {
    auth = fakeAuth(['existing@example.com']);
    svc = createAdminUserService({ db, auth, owners: OWNERS, now: () => NOW });
    const r = await svc.grant('owner@example.com', 'existing@example.com');
    expect(r.accountCreated).toBe(false);
    expect(auth.users.size).toBe(1);
  });

  it('changes nothing for an owner or someone already granted', async () => {
    expect(await svc.grant('owner@example.com', 'owner@example.com')).toMatchObject({ alreadyAdmin: true });
    await svc.grant('owner@example.com', 'a@example.com');
    const before = JSON.stringify([...db.docs]);
    expect(await svc.grant('owner@example.com', 'a@example.com')).toMatchObject({ alreadyAdmin: true });
    expect(JSON.stringify([...db.docs])).toBe(before);
  });

  it('rejects an invalid address without touching anything', async () => {
    for (const bad of ['', 'nope', 'a@b', 'a b@c.com', '@x.com']) await rejects(svc.grant('owner@example.com', bad), 'invalid-argument');
    expect(db.docs.size).toBe(0);
    expect(auth.users.size).toBe(0);
  });

  it('does not record the grant if creating the account fails for a real reason', async () => {
    auth.getUserByEmail = async () => {
      throw Object.assign(new Error('boom'), { code: 'auth/internal-error' });
    };
    await expect(svc.grant('owner@example.com', 'a@example.com')).rejects.toThrow('boom');
    expect(db.docs.size).toBe(0);
  });
});

describe('revoke', () => {
  beforeEach(async () => {
    auth = fakeAuth(['a@example.com']);
    svc = createAdminUserService({ db, auth, owners: OWNERS, now: () => NOW });
    await svc.grant('owner@example.com', 'a@example.com');
  });

  it('removes a granted admin straight away and revokes their sessions', async () => {
    await svc.revoke('owner@example.com', 'A@example.com');
    expect(await svc.isAdmin('a@example.com')).toBe(false);
    expect(auth.revoked).toEqual(['uid0']);
  });

  it('never revokes an owner', async () => {
    await rejects(svc.revoke('a@example.com', 'owner@example.com'), 'permission-denied');
    await rejects(svc.revoke('a@example.com', 'SECOND.owner@example.com'), 'permission-denied');
    expect(await svc.isAdmin('owner@example.com')).toBe(true);
  });

  it('does not let anyone revoke themselves', async () => {
    await rejects(svc.revoke('a@example.com', 'a@example.com'), 'failed-precondition');
    expect(await svc.isAdmin('a@example.com')).toBe(true);
  });

  it('reports someone who was never granted', async () => {
    await rejects(svc.revoke('owner@example.com', 'ghost@example.com'), 'not-found');
  });

  it('still succeeds if their session cannot be revoked', async () => {
    auth.revokeRefreshTokens = async () => {
      throw new Error('unreachable');
    };
    await svc.revoke('owner@example.com', 'a@example.com');
    expect(await svc.isAdmin('a@example.com')).toBe(false);
  });
});

describe('list', () => {
  it('returns owners and granted admins, oldest first', async () => {
    let t = 0;
    svc = createAdminUserService({ db, auth, owners: OWNERS, now: () => new Date(NOW.getTime() + 1000 * t++) });
    await svc.grant('owner@example.com', 'second@example.com');
    await svc.grant('owner@example.com', 'first@example.com');
    const out = await svc.list();
    expect(out.owners).toEqual(['owner@example.com', 'second.owner@example.com']);
    expect(out.admins.map((a) => a.email)).toEqual(['second@example.com', 'first@example.com']);
    expect(out.admins[0]).toMatchObject({ addedBy: 'owner@example.com' });
  });
});
