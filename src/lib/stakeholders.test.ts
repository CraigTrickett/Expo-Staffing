import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStakeholders,
  addStakeholder,
  updateStakeholder,
  deleteStakeholder,
  addSampleStakeholders,
  createSampleStakeholders,
} from './stakeholders';
import type { StaffMember } from '@/types';

describe('stakeholders helper', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const fakeLocalStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    (globalThis as unknown as { localStorage: typeof fakeLocalStorage }).localStorage = fakeLocalStorage;
    (globalThis as unknown as { window: { localStorage: typeof fakeLocalStorage } }).window = {
      localStorage: fakeLocalStorage,
    };
  });

  it('adds and retrieves a stakeholder with name, surname, team, and involvedWith', () => {
    const eventId = 'evt_test_123';
    const added = addStakeholder(eventId, {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      team: 'Executive Leadership',
      involvedWith: ['Keynote / General Session', 'Marketing'],
      phone: '+1 555-0100',
      notes: 'Keynote guest speaker',
    });

    expect(added.id).toMatch(/^stk_/);
    expect(added.firstName).toBe('Jane');
    expect(added.lastName).toBe('Doe');
    expect(added.involvedWith).toEqual(['Keynote / General Session', 'Marketing']);

    const list = getStakeholders(eventId);
    expect(list.some((s) => s.email === 'jane.doe@example.com')).toBe(true);
  });

  it('updates a stakeholder details', () => {
    const eventId = 'evt_test_123';
    const added = addStakeholder(eventId, {
      firstName: 'Bob',
      lastName: 'Smith',
      email: 'bob@example.com',
      team: 'Engineering',
      involvedWith: ['Expo Booths'],
    });

    const updated = updateStakeholder(eventId, added.id, {
      team: 'Product Marketing',
      involvedWith: ['Expo Booths', 'Social Event'],
    });

    expect(updated?.team).toBe('Product Marketing');
    expect(updated?.involvedWith).toEqual(['Expo Booths', 'Social Event']);

    const list = getStakeholders(eventId);
    const item = list.find((s) => s.id === added.id);
    expect(item?.team).toBe('Product Marketing');
  });

  it('deletes a stakeholder', () => {
    const eventId = 'evt_test_123';
    const added = addStakeholder(eventId, {
      firstName: 'Alice',
      lastName: 'Wonder',
      email: 'alice@example.com',
      team: 'Creative',
      involvedWith: ['Swag'],
    });

    expect(deleteStakeholder(eventId, added.id)).toBe(true);
    const list = getStakeholders(eventId);
    expect(list.find((s) => s.id === added.id)).toBeUndefined();
  });

  it('surfaces booth roster members in the unified directory', () => {
    const eventId = 'evt_test_unified';
    const mockRoster: StaffMember[] = [
      {
        id: 'staff_1',
        eventId,
        name: 'Carlos Santana',
        email: 'carlos@example.com',
        totalBookedHours: 2,
        isConfirmed: true,
      },
    ];

    const list = getStakeholders(eventId, mockRoster);
    const carlos = list.find((s) => s.email === 'carlos@example.com');
    expect(carlos).toBeDefined();
    expect(carlos?.firstName).toBe('Carlos');
    expect(carlos?.lastName).toBe('Santana');
    expect(carlos?.involvedWith).toContain('Expo Booths');
  });

  describe('shared storage', () => {
    it('keeps stakeholders in the shared module, not in a device-only key', () => {
      addStakeholder('evt_sh', { firstName: 'Ann', lastName: 'Lee', email: 'ann@x.com', team: 'Exec', involvedWith: [] } as never);
      expect(Object.keys(mockStorage)).toContain('boothduty_module_evt_sh_stakeholders');
      expect(Object.keys(mockStorage)).not.toContain('boothduty_stakeholders_evt_sh');
      expect(getStakeholders('evt_sh')).toHaveLength(1);
    });

    it('moves people an earlier version kept on this device into the shared module, stamped with no time', () => {
      const old = [{ id: 'stk_1', eventId: 'evt_o', firstName: 'Old', lastName: 'Timer', email: 'o@x.com', team: '', involvedWith: [], createdAt: '' }];
      mockStorage['boothduty_stakeholders_evt_o'] = JSON.stringify(old);
      expect(getStakeholders('evt_o').map((s) => s.id)).toEqual(['stk_1']);
      expect(JSON.parse(mockStorage['boothduty_module_evt_o_stakeholders']).updatedAt).toBe('');
    });

    it('prefers the shared copy to an old device-only one', () => {
      mockStorage['boothduty_stakeholders_evt_q'] = JSON.stringify([{ id: 'old' }]);
      mockStorage['boothduty_module_evt_q_stakeholders'] = JSON.stringify({ data: [{ id: 'new', involvedWith: [] }], updatedAt: '2026-05-01T00:00:00.000Z' });
      expect(getStakeholders('evt_q').map((s) => s.id)).toEqual(['new']);
    });

    it('reading an empty event writes nothing that a later sync could treat as newer', () => {
      expect(getStakeholders('evt_empty')).toEqual([]);
      expect(Object.keys(mockStorage).filter((k) => k.includes('evt_empty'))).toEqual([]);
    });

    it('keeps the ids of people derived from the roster the same from one read to the next', () => {
      const roster = [{ id: 'm1', name: 'Maya Lopez', email: 'maya@example.com' }] as never;
      const first = getStakeholders('evt_r', roster).map((s) => s.id);
      const second = getStakeholders('evt_r', roster).map((s) => s.id);
      expect(first).toEqual(second);
      expect(JSON.parse(mockStorage['boothduty_module_evt_r_stakeholders']).updatedAt).toBe('');
    });

    it.each([['null', null], ['a string', 'x'], ['a number', 42], ['an object', {}], ['junk', [1, null, 'a', {}]]])('reads %s as nobody', (_n, data) => {
      mockStorage['boothduty_module_evt_bad_stakeholders'] = JSON.stringify({ data, updatedAt: '2026-05-01T00:00:00.000Z' });
      expect(getStakeholders('evt_bad')).toEqual([]);
    });
  });
});

describe('normaliseInvolvedAreas', () => {
  it('maps the renamed Schedule area and removes duplicates', async () => {
    const { normaliseInvolvedAreas } = await import('./stakeholders');
    expect(normaliseInvolvedAreas(['Session Scheduling', 'Budget'])).toEqual(['Schedule', 'Budget']);
    expect(normaliseInvolvedAreas(['Schedule', 'Session Scheduling'])).toEqual(['Schedule']);
    expect(normaliseInvolvedAreas()).toEqual([]);
  });

  describe('a new event starts without invented people', () => {
    it('has no stakeholders when there is no roster either', () => {
      expect(getStakeholders('evt_new')).toEqual([]);
    });

    it('lists only the booth staff who gave an email, from the roster', () => {
      const roster = [
        { id: 'm1', name: 'Maya Lopez', email: 'maya@example.com' },
        { id: 'm2', name: 'No Email' },
      ] as unknown as StaffMember[];
      const list = getStakeholders('evt_roster', roster);
      expect(list.map((s) => s.email)).toEqual(['maya@example.com']);
      expect(list.some((s) => /saasdisrupt/.test(s.email))).toBe(false);
    });

    it('adds the sample people only when asked, once, and keeps anyone already there', () => {
      expect(getStakeholders('evt_s')).toEqual([]);
      const sample = createSampleStakeholders('evt_s');
      expect(sample.length).toBeGreaterThan(0);
      const added = addSampleStakeholders('evt_s');
      expect(added).toHaveLength(sample.length);
      expect(addSampleStakeholders('evt_s')).toHaveLength(sample.length); // asking again changes nothing
      expect(getStakeholders('evt_s')).toHaveLength(sample.length);
    });
  });
});
