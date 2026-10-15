import { describe, it, expect, beforeEach } from 'vitest';
import {
  getKeynoteSessions,
  createKeynoteSession,
  updateKeynoteSession,
  reorderKeynoteSegments,
  recalculateSegmentTimes,
  deleteKeynoteSession,
  addSampleKeynoteSessions,
  createSampleKeynoteSessions,
  normaliseKeynoteSession,
  normaliseKeynoteSessions,
} from './keynote';
import type { KeyStakeholder, KeynoteSession } from '@/types';

describe('keynote helper', () => {
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

  it('creates and retrieves keynote sessions', () => {
    const eventId = 'evt_test_keynote';
    const session = createKeynoteSession(eventId, {
      title: 'Opening Vision Keynote',
      date: '2026-11-04',
      startTime: '09:00',
      endTime: '10:30',
      stageOrRoom: 'Grand Ballroom',
      slideDeckUrl: 'https://docs.google.com/presentation/d/test-deck',
    });

    expect(session.id).toMatch(/^knt_/);
    expect(session.title).toBe('Opening Vision Keynote');
    expect(session.currentStage).toBe('develop_run_of_show');
    expect(session.rehearsals.length).toBeGreaterThanOrEqual(2);
    expect(session.weeklyMeeting.enabled).toBe(true);

    const all = getKeynoteSessions(eventId);
    expect(all.some((s) => s.id === session.id)).toBe(true);
  });

  it('recalculates segment times sequentially based on durations', () => {
    const eventId = 'evt_test_times';
    const session = createKeynoteSession(eventId, {
      title: 'Session Timing Test',
      date: '2026-11-04',
      startTime: '10:00',
      endTime: '11:00',
      stageOrRoom: 'Stage B',
    });

    session.segments = [
      {
        id: 'seg_1',
        order: 1,
        time: '',
        durationMinutes: 10,
        topic: 'Intro',
        speakerIds: [],
        speakerNames: 'Host',
      },
      {
        id: 'seg_2',
        order: 2,
        time: '',
        durationMinutes: 20,
        topic: 'Keynote',
        speakerIds: [],
        speakerNames: 'CEO',
      },
      {
        id: 'seg_3',
        order: 3,
        time: '',
        durationMinutes: 15,
        topic: 'Customer Story',
        speakerIds: [],
        speakerNames: 'Client',
      },
    ];

    const recalculated = recalculateSegmentTimes(session);
    expect(recalculated.segments[0].time).toBe('10:00 - 10:10');
    expect(recalculated.segments[1].time).toBe('10:10 - 10:30');
    expect(recalculated.segments[2].time).toBe('10:30 - 10:45');
  });

  it('reorders segments up and down correctly', () => {
    const eventId = 'evt_test_reorder';
    const session = createKeynoteSession(eventId, {
      title: 'Reorder Test',
      date: '2026-11-04',
      startTime: '09:00',
      endTime: '10:00',
      stageOrRoom: 'Mainstage',
    });

    session.segments = [
      {
        id: 'seg_a',
        order: 1,
        time: '',
        durationMinutes: 10,
        topic: 'Segment A',
        speakerIds: [],
        speakerNames: 'Speaker A',
      },
      {
        id: 'seg_b',
        order: 2,
        time: '',
        durationMinutes: 15,
        topic: 'Segment B',
        speakerIds: [],
        speakerNames: 'Speaker B',
      },
    ];

    // Move Segment B up
    const reordered = reorderKeynoteSegments(session, 'seg_b', 'up');
    expect(reordered.segments[0].id).toBe('seg_b');
    expect(reordered.segments[1].id).toBe('seg_a');
  });

  it('deletes keynote session from storage', () => {
    const eventId = 'evt_test_del';
    const s1 = createKeynoteSession(eventId, {
      title: 'Session 1',
      date: '2026-11-05',
      startTime: '09:00',
      endTime: '10:00',
      stageOrRoom: 'Room A',
    });
    const s2 = createKeynoteSession(eventId, {
      title: 'Session 2',
      date: '2026-11-05',
      startTime: '10:30',
      endTime: '11:30',
      stageOrRoom: 'Room B',
    });

    const deleted = deleteKeynoteSession(eventId, s1.id);
    expect(deleted).toBe(true);

    const remaining = getKeynoteSessions(eventId);
    expect(remaining.some((s) => s.id === s1.id)).toBe(false);
    expect(remaining.some((s) => s.id === s2.id)).toBe(true);
  });

  describe('a new event starts without made-up sessions', () => {
    it('has none, and does not store any just by looking', () => {
      expect(getKeynoteSessions('evt_new')).toEqual([]);
      expect(Object.keys(mockStorage).filter((k) => k.includes('evt_new'))).toEqual([]);
    });

    it('adds the sample sessions only when asked, and not on top of real ones', () => {
      const sample = addSampleKeynoteSessions('evt_s');
      expect(sample.length).toBeGreaterThan(0);
      expect(getKeynoteSessions('evt_s')).toHaveLength(sample.length);
      expect(addSampleKeynoteSessions('evt_s')).toHaveLength(sample.length);

      const real = createKeynoteSession('evt_real', { title: 'Mine', date: '2026-11-09', startTime: '09:00', endTime: '10:00', stageOrRoom: 'Hall A' });
      expect(addSampleKeynoteSessions('evt_real').map((s) => s.id)).toEqual([real.id]);
    });

    it('the sample sessions are the ones that used to be seeded, dated on the event start', () => {
      expect(createSampleKeynoteSessions('e', '2026-11-04')[0].date).toBe('2026-11-04');
    });
  });

  describe('shared storage', () => {
    it('keeps sessions in the shared module, not in a device-only key', () => {
      createKeynoteSession('evt_m', { title: 'Opening', date: '2026-11-09', startTime: '09:00', endTime: '10:00', stageOrRoom: 'Hall' });
      expect(Object.keys(mockStorage)).toContain('boothduty_module_evt_m_keynote');
      expect(Object.keys(mockStorage)).not.toContain('boothduty_keynotes_evt_m');
      expect(getKeynoteSessions('evt_m')).toHaveLength(1);
    });

    it('moves sessions an earlier version kept on this device into the shared module, stamped with no time', () => {
      const old = createSampleKeynoteSessions('evt_old', '2026-11-04');
      mockStorage['boothduty_keynotes_evt_old'] = JSON.stringify(old);
      const got = getKeynoteSessions('evt_old');
      expect(got).toHaveLength(old.length);
      expect(JSON.parse(mockStorage['boothduty_module_evt_old_keynote']).updatedAt).toBe('');
    });

    it('prefers the shared copy to an old device-only one', () => {
      mockStorage['boothduty_keynotes_evt_p'] = JSON.stringify(createSampleKeynoteSessions('evt_p'));
      mockStorage['boothduty_module_evt_p_keynote'] = JSON.stringify({ data: [], updatedAt: '2026-05-01T00:00:00.000Z' });
      expect(getKeynoteSessions('evt_p')).toEqual([]);
    });

    it('reading never writes a shared copy that a later sync could treat as newer', () => {
      getKeynoteSessions('evt_none');
      expect(Object.keys(mockStorage).filter((k) => k.includes('evt_none'))).toEqual([]);
    });
  });

  describe('corrupt stored data does not take a screen down', () => {
    const wrap = (data: unknown) => JSON.stringify({ data, updatedAt: '2026-05-01T00:00:00.000Z' });
    it.each([
      ['null', null],
      ['a string', 'x'],
      ['a number', 42],
      ['an object', { sessions: [] }],
      ['an array of junk', [1, 'a', null, [], {}, { id: '' }]],
    ])('reads %s as no sessions', (_name, data) => {
      mockStorage['boothduty_module_evt_c_keynote'] = wrap(data);
      expect(getKeynoteSessions('evt_c')).toEqual([]);
    });

    it('reads unparseable text as no sessions', () => {
      mockStorage['boothduty_module_evt_c_keynote'] = '{{{';
      expect(getKeynoteSessions('evt_c')).toEqual([]);
    });

    it('keeps a session that is missing its lists and nested objects, and fills them in', () => {
      mockStorage['boothduty_module_evt_c_keynote'] = wrap([{ id: 'k1', title: 'Half a session' }]);
      const [s] = getKeynoteSessions('evt_c');
      expect(s).toMatchObject({ id: 'k1', title: 'Half a session', segments: [], rehearsals: [], assignedSpeakerIds: [], currentStage: 'develop_run_of_show' });
      expect(s.stage1Narrative.customerCompanies).toEqual([]);
      expect(s.weeklyMeeting.enabled).toBe(true);
    });

    it('drops only the broken sessions from a mixed list', () => {
      mockStorage['boothduty_module_evt_c_keynote'] = wrap([{ id: 'ok', title: 'Fine' }, 'junk', null, { id: 'ok2' }]);
      expect(getKeynoteSessions('evt_c').map((s) => s.id)).toEqual(['ok', 'ok2']);
    });
  });

  describe('normaliseKeynoteSession', () => {
    it('repairs segments: wrong types, missing ids, negative or non-numeric durations', () => {
      const s = normaliseKeynoteSession({ id: 'k', segments: [{ topic: 5, durationMinutes: -3, speakerIds: 'x' }, 'bad', { id: 's2', durationMinutes: 'ten', order: 'first' }] })!;
      expect(s.segments).toHaveLength(2);
      expect(s.segments[0]).toMatchObject({ id: 'seg_0', topic: '', durationMinutes: 0, speakerIds: [], order: 1 });
      expect(s.segments[1]).toMatchObject({ id: 's2', durationMinutes: 10, order: 2 });
    });
    it('falls back to a valid stage', () => {
      expect(normaliseKeynoteSession({ id: 'k', currentStage: 'nonsense' })!.currentStage).toBe('develop_run_of_show');
      expect(normaliseKeynoteSession({ id: 'k', currentStage: 'signed_off' })!.currentStage).toBe('signed_off');
    });
    it('leaves a good session as it was', () => {
      const [good] = createSampleKeynoteSessions('e', '2026-11-04');
      expect(normaliseKeynoteSession(good)).toEqual(good);
      expect(normaliseKeynoteSessions([good])).toEqual([good]);
    });
    it('returns null for something that is not a session', () => {
      for (const v of [null, undefined, 3, 'x', [], {}, { id: 3 }]) expect(normaliseKeynoteSession(v)).toBeNull();
    });
  });
});
