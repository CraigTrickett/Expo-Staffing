import { describe, it, expect, beforeEach } from 'vitest';
import {
  getKeynoteSessions,
  createKeynoteSession,
  updateKeynoteSession,
  reorderKeynoteSegments,
  recalculateSegmentTimes,
  generateKeynoteMarkdown,
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

  it('generates structured Markdown table with slide deck links and stage cues', () => {
    const eventId = 'evt_test_markdown';
    const session = createKeynoteSession(eventId, {
      title: 'Spatial AI General Session',
      date: '2026-11-05',
      startTime: '09:00',
      endTime: '10:00',
      stageOrRoom: 'Mainstage Hall',
      slideDeckUrl: 'https://docs.google.com/presentation/d/sample-keynote',
    });

    session.stage1Narrative.themeStatement = 'Connected Spatial Workflows';
    session.stage1Narrative.flowHandoverNotes = '3D motion graphic bridge';
    session.stage1Narrative.customerInvolvementNotes = 'Acme Corp on-stage demo';

    const mockStakeholders: KeyStakeholder[] = [
      {
        id: 'stk_speaker_1',
        eventId,
        firstName: 'Elena',
        lastName: 'Rostova',
        email: 'elena@example.com',
        team: 'Product Marketing',
        involvedWith: ['Keynote / General Session'],
        createdAt: new Date().toISOString(),
      },
    ];

    session.segments = [
      {
        id: 'seg_intro',
        order: 1,
        time: '09:00 - 09:10',
        durationMinutes: 10,
        topic: 'Keynote Introduction',
        speakerIds: ['stk_speaker_1'],
        speakerNames: 'Elena Rostova',
        handoverNotes: 'Opening video bumper into walk-on',
        slideDeckLink: 'https://docs.google.com/presentation/d/sample-keynote#slide=1',
        cueNotes: 'Dim hall lights, mic check',
      },
    ];

    const markdown = generateKeynoteMarkdown(session, mockStakeholders);

    // Verify Title & Metadata
    expect(markdown).toContain('# Spatial AI General Session');
    expect(markdown).toContain('Connected Spatial Workflows');
    expect(markdown).toContain('Acme Corp on-stage demo');
    expect(markdown).toContain('https://docs.google.com/presentation/d/sample-keynote');

    // Verify Structured Markdown Table Header
    expect(markdown).toContain('| Time | Duration | Speaker(s) | Topic / Segment | Handover / Transition | Slide / Deck Link | Stage Cues & AV Notes |');
    expect(markdown).toContain('| :--- | :--- | :--- | :--- | :--- | :--- | :--- |');

    // Verify Row Content
    expect(markdown).toContain('| 09:00 - 09:10 | 10 min | Elena Rostova | Keynote Introduction | Opening video bumper into walk-on | [Slides](https://docs.google.com/presentation/d/sample-keynote#slide=1) | Dim hall lights, mic check |');
  });
});
