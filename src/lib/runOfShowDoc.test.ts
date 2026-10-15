import { describe, it, expect } from 'vitest';
import {
  buildRunOfShowDoc,
  DOC_COLOURS,
  EMPTY_DOCUMENT_SETTINGS,
  formatLongDate,
  ordinal,
  renderRunOfShowHtml,
  renderRunOfShowMarkdown,
} from './runOfShowDoc';
import { generateKeynoteHtml, generateKeynoteMarkdown } from './keynote';
import type { KeynoteSession, KeyStakeholder, RunOfShowSegment } from '@/types';
import type { Task } from '@/types/tasks';

const person = (id: string, first: string, last: string): KeyStakeholder => ({
  id, eventId: 'e', firstName: first, lastName: last, email: '', team: 'T', involvedWith: [], createdAt: '',
});
const people = [person('stk_chris', 'Chris', 'Peppler'), person('stk_angie', 'Angie', 'Wiering')];

const seg = (over: Partial<RunOfShowSegment>): RunOfShowSegment => ({
  id: 's', order: 1, time: '', durationMinutes: 10, topic: 'Opening', speakerIds: [], speakerNames: '', ...over,
});

const full = seg({
  topic: 'Opening \u2014 The Builders of the Builders',
  speakerIds: ['stk_chris'],
  theme: 'Platform, not Product',
  keyMessage: 'Today is about building across the platform.',
  takeaway: 'Every product node is the hero of its own story.',
  timingNotes: 'No demo in this slot.',
  handoverNotes: 'Hands directly to the Product Lead.',
});

const session = (over: Partial<KeynoteSession> = {}): KeynoteSession =>
  ({
    id: 's1', eventId: 'e', title: 'Building on the Platform', date: '2026-11-09', startTime: '11:00', endTime: '12:00',
    stageOrRoom: 'Murano 3202, 3203, 3204', currentStage: 'develop_run_of_show', assignedSpeakerIds: [],
    stage1Narrative: { confirmedNarrative: false, themeStatement: '', coreMessage: '', flowHandoverNotes: '', hasConnectingGraphics: false, customerInvolvementNotes: '', customerCompanies: [] },
    weeklyMeeting: {} as never, rehearsals: [], segments: [full], createdAt: '', updatedAt: '', ...over,
  }) as KeynoteSession;

const build = (sessions: KeynoteSession[], extra = {}) =>
  buildRunOfShowDoc({ eventTitle: 'Dev Summit', settings: EMPTY_DOCUMENT_SETTINGS, sessions, stakeholders: people, ...extra });

describe('dates', () => {
  it('formats the long date the way the reference does', () => {
    expect(formatLongDate('2026-11-09')).toBe('Monday 9th November');
    expect(formatLongDate('2026-11-01')).toBe('Sunday 1st November');
    expect(formatLongDate('2026-11-22')).toBe('Sunday 22nd November');
    expect(formatLongDate('2026-11-23')).toBe('Monday 23rd November');
    expect(formatLongDate('nonsense')).toBe('nonsense');
  });
  it('gets the awkward ordinals right', () => {
    expect([11, 12, 13, 21, 22, 23, 30, 31].map(ordinal)).toEqual(['11th', '12th', '13th', '21st', '22nd', '23rd', '30th', '31st']);
  });
});

describe('document model', () => {
  it('gives one segment the five rows of the reference: title, speaker, takeaway, timing, transition', () => {
    const doc = build([session()]);
    const rows = doc.sessions[0].blocks[0].rows;
    expect(rows.map((r) => r.kind)).toEqual(['title', 'speaker', 'takeaway', 'timing', 'transition']);
    expect(rows[0]).toMatchObject({ segmentStyle: 'bold', label: 'Theme:', shade: 'blue' });
    expect(rows[1]).toMatchObject({ segment: 'Chris Peppler', segmentStyle: 'italic', label: 'Key Message:' });
    expect(rows[4]).toMatchObject({ label: 'Transition:', shade: 'grey', italic: true });
  });

  it('uses RT, location, date line and the runtime sentence of the reference', () => {
    const doc = build([session()]);
    const s = doc.sessions[0];
    expect(s.blocks[0].rt).toBe('~10');
    expect(s.blocks[0].location).toBe('Murano 3202, 3203, 3204');
    expect(s.dateLine).toBe('Monday 9th November - 11:00 to 12:00');
    expect(s.runtime).toBe('Total runtime: ~60 minutes (10 allocated, 50 held for transitions and overrun) \u00b7 Single speaker \u00b7 Murano 3202, 3203, 3204');
  });

  it('says multi-speaker, and reports an overrun instead of a negative hold', () => {
    const many = session({ segments: [seg({ durationMinutes: 40, speakerIds: ['stk_chris'] }), seg({ durationMinutes: 30, speakerIds: ['stk_angie'] })] });
    expect(build([many]).sessions[0].runtime).toBe('Total runtime: ~70 minutes (10 over the 60-minute slot) \u00b7 Multi-speaker \u00b7 Murano 3202, 3203, 3204');
    const exact = session({ segments: [seg({ durationMinutes: 60 })] });
    expect(build([exact]).sessions[0].runtime).toMatch(/^Total runtime: ~60 minutes \u00b7 /);
  });

  it('leaves out rows that have no content instead of printing blanks', () => {
    const bare = session({ segments: [seg({ topic: 'Break', speakerNames: 'Host' })] });
    const rows = build([bare]).sessions[0].blocks[0].rows;
    expect(rows.map((r) => r.kind)).toEqual(['title', 'speaker']);
    expect(rows[0].label).toBe('');
    const silent = session({ segments: [seg({ topic: 'Video' })] });
    expect(build([silent]).sessions[0].blocks[0].rows.map((r) => r.kind)).toEqual(['title']);
  });

  it('keeps stage cues and slide links out unless asked, and puts them before the transition when asked', () => {
    const withExtras = session({ slideDeckUrl: 'https://docs.google.com/presentation/d/x', segments: [{ ...full, cueNotes: 'Lapel mic 1' }] });
    expect(build([withExtras]).sessions[0].blocks[0].rows.map((r) => r.kind)).not.toContain('cues');
    const on = build([withExtras], { options: { includeCues: true, includeSlideLinks: true } });
    expect(on.sessions[0].blocks[0].rows.map((r) => r.kind)).toEqual(['title', 'speaker', 'takeaway', 'timing', 'cues', 'slides', 'transition']);
  });

  it('orders sessions by date and time, numbers them, and prints the break between them only', () => {
    const afternoon = session({ id: 'b', title: 'Afternoon', startTime: '13:30', endTime: '14:30', breakAfter: 'After party' });
    const morning = session({ id: 'a', title: 'Morning', breakAfter: 'Lunch Break' });
    const doc = build([afternoon, morning]);
    expect(doc.sessions.map((s) => s.heading)).toEqual(['Session 1 \u2014 Morning', 'Session 2 \u2014 Afternoon']);
    expect(doc.sessions.map((s) => s.breakAfter)).toEqual(['Lunch Break', '']);
  });

  it('does not number a single session', () => {
    expect(build([session()]).sessions[0].heading).toBe('Building on the Platform');
  });

  it('builds the title block, with the event name as the fallback title', () => {
    expect(build([session()]).title).toBe('Dev Summit \u2014 Run of Show');
    const doc = build([session()], { settings: { ...EMPTY_DOCUMENT_SETTINGS, title: 'Custom', headline: 'Big idea', descriptor: 'Inaugural' } });
    expect(doc).toMatchObject({ title: 'Custom', headline: 'Big idea', descriptor: 'Inaugural' });
  });

  it('builds Objective, Message and Structure, falling back to the narrative already written', () => {
    const narrative = { confirmedNarrative: true, themeStatement: 'Shift perception', coreMessage: 'Giving data a brain', flowHandoverNotes: 'Two sessions', hasConnectingGraphics: false, customerInvolvementNotes: '', customerCompanies: [] };
    const doc = build([session({ stage1Narrative: narrative })]);
    expect(doc.intro).toEqual([
      { label: 'Objective:', text: 'Shift perception' },
      { label: 'Message:', text: 'Giving data a brain' },
      { label: 'Structure:', text: 'Two sessions' },
    ]);
    const typed = build([session({ stage1Narrative: narrative })], { settings: { ...EMPTY_DOCUMENT_SETTINGS, message: 'Typed wins' } });
    expect(typed.intro[1].text).toBe('Typed wins');
    expect(build([session()]).intro).toEqual([]);
  });

  it('splits an abstract into paragraphs', () => {
    expect(build([session({ abstract: 'One.\n\nTwo\nstill two.' })]).sessions[0].abstract).toEqual(['One.', 'Two still two.']);
  });

  it('prints only open tasks as Open Items, with raised by and a due date', () => {
    const task = (over: Partial<Task>): Task => ({ id: 'x', title: 'T', status: 'open', createdAt: '', ...over });
    const doc = build([session()], {
      openItems: [
        task({ title: 'Confirm customer', raisedBy: 'Angie Wiering, 28 Jul', dueDate: '2026-10-20', notes: 'Kope preferred' }),
        task({ title: 'Already done', status: 'done' }),
        task({ title: 'No owner' }),
      ],
    });
    expect(doc.openItems).toEqual([
      { item: 'Confirm customer', raisedBy: 'Angie Wiering, 28 Jul', status: 'Open, due 20 Oct. Kope preferred' },
      { item: 'No owner', raisedBy: '\u2013', status: 'Open' },
    ]);
  });
});

describe('HTML', () => {
  const html = renderRunOfShowHtml(build([session({ abstract: 'Abstract text.', breakAfter: 'Lunch Break' }), session({ id: 'b', title: 'Two', startTime: '13:30', endTime: '14:30' })]));

  it('has the four column header in the reference navy with white text', () => {
    for (const label of ['RT', 'Location', 'Segment', 'Notes']) expect(html).toContain(`>${label}</td>`);
    expect(html).toContain(`bgcolor="${DOC_COLOURS.headerBg}"`);
    expect(html).toContain('<colgroup><col width="7%"><col width="14%"><col width="22%"><col width="57%"></colgroup>');
  });

  it('merges RT and Location down the whole segment, which is five rows here', () => {
    expect(html.match(/<td rowspan="5" valign="middle"/g)).toHaveLength(4); // RT + Location, two sessions
    expect(html).not.toMatch(/rowspan="1"/);
  });

  it('shades the title row blue and the transition row grey, on both cells', () => {
    expect(html.match(new RegExp(`bgcolor="${DOC_COLOURS.blue}"`, 'g'))).toHaveLength(4); // 2 cells x 2 sessions
    expect(html.match(new RegExp(`bgcolor="${DOC_COLOURS.grey}"`, 'g'))).toHaveLength(4);
  });

  it('bolds the labels, italicises the speaker and the transition', () => {
    expect(html).toContain('<b>Theme:</b> Platform, not Product');
    expect(html).toContain('<b>Key Message:</b>');
    expect(html).toContain('<b>Takeaway/Understanding:</b>');
    expect(html).toContain('<b>Timing:</b>');
    expect(html).toContain('<i>Chris Peppler</i>');
    expect(html).toContain('<i><b>Transition:</b> Hands directly to the Product Lead.</i>');
  });

  it('prints the abstract, runtime line and the break between sessions', () => {
    expect(html).toContain('<b>Abstract:</b> Abstract text.');
    expect(html).toContain('Total runtime: ~60 minutes');
    expect(html).toContain('<b>Lunch Break</b>');
    expect(html.indexOf('Lunch Break')).toBeGreaterThan(html.indexOf('Session 1'));
    expect(html.indexOf('Lunch Break')).toBeLessThan(html.indexOf('Session 2'));
  });

  it('escapes anything typed into the app', () => {
    const evil = renderRunOfShowHtml(build([session({ title: '<script>alert(1)</script>', segments: [seg({ topic: '<img src=x onerror=1>', theme: 'a & b' })] })]));
    expect(evil).not.toContain('<script>');
    expect(evil).not.toContain('<img');
    expect(evil).toContain('&lt;script&gt;');
    expect(evil).toContain('a &amp; b');
  });
});

describe('Markdown', () => {
  const md = renderRunOfShowMarkdown(build([session({ abstract: 'Abstract text.' })]));

  it('writes each segment as the reference does, one row per field', () => {
    expect(md).toContain('| RT | Location | Segment | Notes |');
    expect(md).toContain('| ~10 | Murano 3202, 3203, 3204 | **Opening \u2014 The Builders of the Builders** | **Theme:** Platform, not Product |');
    expect(md).toContain('|  |  | *Chris Peppler* | **Key Message:** Today is about building across the platform. |');
    expect(md).toContain('|  |  |  | **Takeaway/Understanding:** Every product node is the hero of its own story. |');
    expect(md).toContain('|  |  |  | **Timing:** No demo in this slot. |');
    expect(md).toContain('|  |  |  | ***Transition:** Hands directly to the Product Lead.* |');
  });

  it('has the title block, session heading, abstract and runtime', () => {
    expect(md.startsWith('# Dev Summit \u2014 Run of Show')).toBe(true);
    expect(md).toContain('**Building on the Platform**');
    expect(md).toContain('Monday 9th November - 11:00 to 12:00');
    expect(md).toContain('**Abstract:** Abstract text.');
  });

  it('keeps a pipe in the text from breaking the table', () => {
    const piped = renderRunOfShowMarkdown(build([session({ segments: [seg({ topic: 'A | B', theme: 'x | y' })] })]));
    expect(piped).toContain('**A \\| B** | **Theme:** x \\| y |');
  });
});

describe('keynote.ts wrappers', () => {
  it('accept one session or a list, and agree with the renderers', () => {
    const s = session();
    expect(generateKeynoteMarkdown(s, people)).toBe(generateKeynoteMarkdown([s], people));
    expect(generateKeynoteHtml(s, people)).toContain('<table');
    expect(generateKeynoteMarkdown(s, people)).toBe(renderRunOfShowMarkdown(build([s], { eventTitle: '' })).replace('Dev Summit', ''));
  });
});
