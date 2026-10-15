// Tests firestore.rules against the Firebase emulator. Run with:  npm run test:rules
// (needs the Firebase CLI and Java. The emulator is started and stopped for you.)
//
// Not run in the environment where it was written, which had no emulator: run it before deploying the rules.
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, it } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore';

const OWNER = 'craig_trickett@trimble.com';
const GRANTED = 'colleague@trimble.com';
const STRANGER = 'stranger@example.com';

let env;

const event = () => ({
  adminKey: 'adm1',
  publicKey: 'pub1',
  config: { id: 'e1', title: 'Summit', adminKey: 'adm1', publicKey: 'pub1', staffCapacityPerSlot: 2 },
  slots: [{ id: 's1', capacity: 2, bookings: [] }],
  roster: [{ id: 'ann', name: 'Ann' }],
  updatedAt: '2026-01-01T00:00:00.000Z',
});

before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-showrunner', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
after(async () => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'boothEvents/e1'), event());
    await setDoc(doc(db, 'publicLinks/pub1'), { eventId: 'e1' });
    await setDoc(doc(db, 'boothEvents/e1/modules/budget'), { data: { secret: 1 }, updatedAt: '2026-01-01' });
    await setDoc(doc(db, `adminUsers/${GRANTED}`), { addedBy: OWNER });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const as = (email) => env.authenticatedContext(email.split('@')[0], { email }).firestore();

describe('someone with a staff link, not signed in', () => {
  it('can open one event by its id', () => assertSucceeds(getDoc(doc(anon(), 'boothEvents/e1'))));
  it('can find an event from its public key', () => assertSucceeds(getDoc(doc(anon(), 'publicLinks/pub1'))));
  it('cannot list events', () => assertFails(getDocs(collection(anon(), 'boothEvents'))));
  it('cannot list events by asking for a key', async () => {
    const { query, where } = await import('firebase/firestore');
    await assertFails(getDocs(query(collection(anon(), 'boothEvents'), where('publicKey', '==', 'pub1'))));
  });
  it('cannot list the public links', () => assertFails(getDocs(collection(anon(), 'publicLinks'))));
  it('can claim and release shifts, and add themselves: slots, roster and time', () =>
    assertSucceeds(updateDoc(doc(anon(), 'boothEvents/e1'), { slots: [{ id: 's1', capacity: 2, bookings: [{ id: 'b1' }] }], roster: [{ id: 'ann' }, { id: 'bob' }], updatedAt: '2026-02-01T00:00:00.000Z' })));
  it('cannot change the event details, capacity or keys', async () => {
    await assertFails(updateDoc(doc(anon(), 'boothEvents/e1'), { config: { ...event().config, staffCapacityPerSlot: 99 } }));
    await assertFails(updateDoc(doc(anon(), 'boothEvents/e1'), { adminKey: 'stolen' }));
    await assertFails(updateDoc(doc(anon(), 'boothEvents/e1'), { publicKey: 'other' }));
  });
  it('cannot add fields, including in the same write as a permitted change', async () => {
    await assertFails(updateDoc(doc(anon(), 'boothEvents/e1'), { extra: true }));
    await assertFails(updateDoc(doc(anon(), 'boothEvents/e1'), { slots: [], stakeholders: [] }));
  });
  it('cannot create or delete an event, or a public link', async () => {
    await assertFails(setDoc(doc(anon(), 'boothEvents/e2'), event()));
    await assertFails(deleteDoc(doc(anon(), 'boothEvents/e1')));
    await assertFails(setDoc(doc(anon(), 'publicLinks/x'), { eventId: 'e1' }));
    await assertFails(deleteDoc(doc(anon(), 'publicLinks/pub1')));
  });
  it('cannot read or write module data, or calendar tokens, or grant admin', async () => {
    await assertFails(getDoc(doc(anon(), 'boothEvents/e1/modules/budget')));
    await assertFails(setDoc(doc(anon(), 'boothEvents/e1/modules/budget'), { data: {} }));
    await assertFails(getDoc(doc(anon(), 'organizerCalendarTokens/e1')));
    await assertFails(setDoc(doc(anon(), `adminUsers/${STRANGER}`), { addedBy: 'me' }));
  });
});

describe('someone signed in who is not an admin', () => {
  it('has no more access than a signed-out person', async () => {
    const db = as(STRANGER);
    await assertSucceeds(getDoc(doc(db, 'boothEvents/e1')));
    await assertFails(getDocs(collection(db, 'boothEvents')));
    await assertFails(getDoc(doc(db, 'boothEvents/e1/modules/budget')));
    await assertFails(updateDoc(doc(db, 'boothEvents/e1'), { config: { title: 'x' } }));
    await assertFails(deleteDoc(doc(db, 'boothEvents/e1')));
  });
});

describe('an owner or a granted admin', () => {
  for (const [label, email] of [['owner', OWNER], ['granted admin', GRANTED]]) {
    it(`${label} can list, create, change and delete events`, async () => {
      const db = as(email);
      await assertSucceeds(getDocs(collection(db, 'boothEvents')));
      await assertSucceeds(setDoc(doc(db, 'boothEvents/e2'), { ...event(), publicKey: 'pub2' }));
      await assertSucceeds(updateDoc(doc(db, 'boothEvents/e1'), { config: { ...event().config, title: 'Renamed' } }));
      await assertSucceeds(deleteDoc(doc(db, 'boothEvents/e2')));
    });
    it(`${label} can use module data and public links`, async () => {
      const db = as(email);
      await assertSucceeds(getDoc(doc(db, 'boothEvents/e1/modules/budget')));
      await assertSucceeds(setDoc(doc(db, 'boothEvents/e1/modules/stakeholders'), { data: [], updatedAt: '2026-02-01' }));
      await assertSucceeds(setDoc(doc(db, 'publicLinks/pub9'), { eventId: 'e1' }));
    });
  }
  it('can read their own adminUsers entry but nobody can write one from a client', async () => {
    await assertSucceeds(getDoc(doc(as(GRANTED), `adminUsers/${GRANTED}`)));
    await assertFails(setDoc(doc(as(OWNER), `adminUsers/${STRANGER}`), { addedBy: OWNER }));
    await assertFails(getDoc(doc(as(STRANGER), `adminUsers/${GRANTED}`)));
  });
  it('calendar tokens stay locked even for an owner', async () => {
    await assertFails(getDoc(doc(as(OWNER), 'organizerCalendarTokens/e1')));
  });
});
