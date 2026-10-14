import { describe, it, expect, beforeEach } from 'vitest';
import {
  getStakeholders,
  addStakeholder,
  updateStakeholder,
  deleteStakeholder,
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
});
