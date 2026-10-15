import { describe, it, expect } from 'vitest';
import { toStakeholderRef, resolveStakeholderRef, describeStakeholderRef } from './stakeholderRef';
import type { KeyStakeholder } from '@/types';

const sarah: KeyStakeholder = {
  id: 'stk_sarah',
  eventId: 'e',
  firstName: 'Sarah',
  lastName: 'Chen',
  email: 's@example.com',
  team: 'Executive Leadership',
  involvedWith: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('stakeholder references', () => {
  it('snapshots the full name', () => {
    expect(toStakeholderRef(sarah)).toEqual({ id: 'stk_sarah', name: 'Sarah Chen' });
  });

  it('prefers the current name when the stakeholder still exists', () => {
    const renamed = { ...sarah, lastName: 'Chen-Wu' };
    const r = resolveStakeholderRef({ id: 'stk_sarah', name: 'Sarah Chen' }, [renamed]);
    expect(r).toMatchObject({ name: 'Sarah Chen-Wu', removed: false });
  });

  it('falls back to the snapshot and flags a removed stakeholder', () => {
    const r = resolveStakeholderRef({ id: 'gone', name: 'Marcus Vance' }, [sarah]);
    expect(r).toEqual({ name: 'Marcus Vance', removed: true });
    expect(describeStakeholderRef({ id: 'gone', name: 'Marcus Vance' }, [sarah])).toBe('Marcus Vance (removed)');
  });

  it('handles an empty reference', () => {
    expect(resolveStakeholderRef(undefined, [sarah])).toBeNull();
    expect(describeStakeholderRef(null, [sarah])).toBe('');
  });
});
