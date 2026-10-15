/**
 * Who is an admin, and how that changes.
 *
 * Two kinds of admin:
 *   - Owners: a fixed list kept in code (and mirrored in firestore.rules and
 *     src/lib/firebase.ts). They are always admins and can never be revoked, so
 *     the app can't be locked out of itself.
 *   - Granted admins: one document per person in the adminUsers collection,
 *     written only by the functions below. Clients can read their own document
 *     (so the app can tell they are an admin) but never write any.
 *
 * Kept free of firebase-functions so every rule here can be tested with fakes.
 */

const ADMIN_USERS_COLLECTION = 'adminUsers';

/** Kept in step with ALLOWED_ADMIN_EMAILS in src/lib/firebase.ts and the list in firestore.rules. */
const OWNER_EMAILS = ['craig_trickett@trimble.com', 'craigtrickett@gmail.com'];

class ServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const normaliseEmail = (value) => String(value || '').trim().toLowerCase();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

function createAdminUserService({ db, auth, owners = OWNER_EMAILS, now = () => new Date() }) {
  const ownerSet = new Set(owners.map(normaliseEmail));
  const collection = () => db.collection(ADMIN_USERS_COLLECTION);

  async function isAdmin(rawEmail) {
    const email = normaliseEmail(rawEmail);
    if (!email) return false;
    if (ownerSet.has(email)) return true;
    const snap = await collection().doc(email).get();
    return snap.exists;
  }

  async function list() {
    const snap = await collection().get();
    const admins = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      admins.push({ email: doc.id, addedBy: d.addedBy || '', addedAt: d.addedAt || '' });
    });
    admins.sort((a, b) => (a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : a.email.localeCompare(b.email)));
    return { owners: [...ownerSet], admins };
  }

  /**
   * Makes someone an admin. If they have no account yet one is created without a
   * password, and the caller is told so, so the app can send them a "set your
   * password" email. Granting someone who is already an admin changes nothing.
   */
  async function grant(callerEmail, rawEmail) {
    const email = normaliseEmail(rawEmail);
    if (!isValidEmail(email)) throw new ServiceError('invalid-argument', 'Enter a valid email address.');
    if (await isAdmin(email)) return { email, alreadyAdmin: true, accountCreated: false };

    let accountCreated = false;
    try {
      await auth.getUserByEmail(email);
    } catch (err) {
      if (err && err.code === 'auth/user-not-found') {
        await auth.createUser({ email, emailVerified: false });
        accountCreated = true;
      } else {
        throw err;
      }
    }

    await collection().doc(email).set({
      email,
      addedBy: normaliseEmail(callerEmail),
      addedAt: now().toISOString(),
    });
    return { email, alreadyAdmin: false, accountCreated };
  }

  async function revoke(callerEmail, rawEmail) {
    const email = normaliseEmail(rawEmail);
    if (!isValidEmail(email)) throw new ServiceError('invalid-argument', 'Enter a valid email address.');
    if (ownerSet.has(email)) throw new ServiceError('permission-denied', 'Owners cannot be revoked.');
    if (email === normaliseEmail(callerEmail)) {
      throw new ServiceError('failed-precondition', 'You cannot revoke your own access.');
    }

    const ref = collection().doc(email);
    const snap = await ref.get();
    if (!snap.exists) throw new ServiceError('not-found', 'That person is not a granted admin.');
    await ref.delete();

    // Best effort: stop their current session minting fresh tokens. Access is already cut,
    // because every check reads the adminUsers document at the moment it is made.
    try {
      const user = await auth.getUserByEmail(email);
      await auth.revokeRefreshTokens(user.uid);
    } catch (err) {
      /* the account may not exist, or be unreachable: the revocation above is what matters */
    }
    return { email };
  }

  return { isAdmin, list, grant, revoke };
}

module.exports = { createAdminUserService, ServiceError, normaliseEmail, isValidEmail, OWNER_EMAILS, ADMIN_USERS_COLLECTION };
