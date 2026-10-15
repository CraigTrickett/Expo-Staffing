import type { KeynoteSession, KeyStakeholder, RunOfShowSegment } from '@/types';
import type { KeynoteDocumentSettings } from '@/types/keynoteDocument';
import type { Task } from '@/types/tasks';

/**
 * The run of show document, built once as plain data and then rendered as HTML
 * (the in-app preview and the Google Docs paste) and as Markdown. Both renderers
 * read the same model, so the three outputs cannot drift apart.
 *
 * Layout follows the Developer Summit run of show: a title block, an Objective /
 * Message / Structure table, then for each session a heading, date and time,
 * abstract and runtime line above a four column table (RT, Location, Segment,
 * Notes) where each segment spans several rows: Theme, Key Message,
 * Takeaway/Understanding, Timing and Transition. Rows with no content are left
 * out rather than printed empty.
 */

export interface RunOfShowDocOptions {
  /** Stage cues are not part of the reference layout, so they are off unless asked for. */
  includeCues?: boolean;
  includeSlideLinks?: boolean;
}

export interface RunOfShowDocInput {
  eventTitle: string;
  settings: KeynoteDocumentSettings;
  sessions: KeynoteSession[];
  stakeholders: KeyStakeholder[];
  /** Tasks tagged to the keynote module. Only open ones are printed. */
  openItems?: Task[];
  options?: RunOfShowDocOptions;
}

export const EMPTY_DOCUMENT_SETTINGS: KeynoteDocumentSettings = {
  title: '',
  headline: '',
  descriptor: '',
  objective: '',
  message: '',
  structure: '',
};

export type RowKind = 'title' | 'speaker' | 'keyMessage' | 'takeaway' | 'timing' | 'transition' | 'cues' | 'slides';

export interface DocRow {
  kind: RowKind;
  /** Left (Segment) cell text. Empty for every row except the title and speaker rows. */
  segment: string;
  segmentStyle: 'bold' | 'italic' | 'plain';
  /** Right (Notes) cell: an optional bold label then text. */
  label: string;
  text: string;
  href?: string;
  shade: 'blue' | 'grey' | 'none';
  italic: boolean;
}

export interface DocBlock {
  rt: string;
  location: string;
  rows: DocRow[];
}

export interface DocSession {
  heading: string;
  dateLine: string;
  abstract: string[];
  runtime: string;
  blocks: DocBlock[];
  breakAfter: string;
}

export interface DocOpenItem {
  item: string;
  raisedBy: string;
  status: string;
}

export interface RunOfShowDoc {
  title: string;
  headline: string;
  descriptor: string;
  intro: { label: string; text: string }[];
  sessions: DocSession[];
  openItems: DocOpenItem[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "2026-11-09" becomes "Monday 9th November". Anything unreadable comes back unchanged. */
export function formatLongDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12));
  return `${WEEKDAYS[date.getUTCDay()]} ${ordinal(date.getUTCDate())} ${MONTHS[date.getUTCMonth()]}`;
}

function formatShortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1].slice(0, 3)}`;
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function speakerNamesFor(seg: RunOfShowSegment, stakeholders: KeyStakeholder[]): string[] {
  const byId = new Map(stakeholders.map((s) => [s.id, `${s.firstName} ${s.lastName}`.trim()]));
  const fromIds = (seg.speakerIds ?? []).map((id) => byId.get(id)).filter((n): n is string => !!n);
  if (fromIds.length > 0) return fromIds;
  const typed = seg.speakerNames?.trim();
  return typed ? [typed] : [];
}

const paragraphs = (text?: string): string[] =>
  (text ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);

const clean = (text?: string): string => (text ?? '').replace(/\s*\n\s*/g, ' ').trim();

function runtimeLine(session: KeynoteSession, speakerCount: number): string {
  const toMin = (t: string) => {
    const [h, m] = (t || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  let window = toMin(session.endTime) - toMin(session.startTime);
  if (window <= 0) window += 1440;
  const allocated = session.segments.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);
  const spare = window - allocated;

  let length: string;
  if (spare > 0) length = `~${window} minutes (${allocated} allocated, ${spare} held for transitions and overrun)`;
  else if (spare === 0) length = `~${window} minutes`;
  else length = `~${allocated} minutes (${-spare} over the ${window}-minute slot)`;

  const parts = [`Total runtime: ${length}`];
  if (speakerCount > 1) parts.push('Multi-speaker');
  else if (speakerCount === 1) parts.push('Single speaker');
  if (session.stageOrRoom?.trim()) parts.push(session.stageOrRoom.trim());
  return parts.join(' \u00b7 ');
}

function buildBlock(seg: RunOfShowSegment, session: KeynoteSession, stakeholders: KeyStakeholder[], options: RunOfShowDocOptions): DocBlock {
  const rows: DocRow[] = [];
  const speakers = joinNames(speakerNamesFor(seg, stakeholders));

  rows.push({
    kind: 'title',
    segment: clean(seg.topic) || 'Untitled segment',
    segmentStyle: 'bold',
    label: clean(seg.theme) ? 'Theme:' : '',
    text: clean(seg.theme),
    shade: 'blue',
    italic: false,
  });

  if (speakers || clean(seg.keyMessage)) {
    rows.push({
      kind: 'speaker',
      segment: speakers,
      segmentStyle: 'italic',
      label: clean(seg.keyMessage) ? 'Key Message:' : '',
      text: clean(seg.keyMessage),
      shade: 'none',
      italic: false,
    });
  }
  if (clean(seg.takeaway)) {
    rows.push({ kind: 'takeaway', segment: '', segmentStyle: 'plain', label: 'Takeaway/Understanding:', text: clean(seg.takeaway), shade: 'none', italic: false });
  }
  if (clean(seg.timingNotes)) {
    rows.push({ kind: 'timing', segment: '', segmentStyle: 'plain', label: 'Timing:', text: clean(seg.timingNotes), shade: 'none', italic: false });
  }
  if (options.includeCues && clean(seg.cueNotes)) {
    rows.push({ kind: 'cues', segment: '', segmentStyle: 'plain', label: 'Stage cues & AV:', text: clean(seg.cueNotes), shade: 'none', italic: false });
  }
  const slide = seg.slideDeckLink || session.slideDeckUrl;
  if (options.includeSlideLinks && slide) {
    rows.push({ kind: 'slides', segment: '', segmentStyle: 'plain', label: 'Slides:', text: slide, href: slide, shade: 'none', italic: false });
  }
  if (clean(seg.handoverNotes)) {
    rows.push({ kind: 'transition', segment: '', segmentStyle: 'plain', label: 'Transition:', text: clean(seg.handoverNotes), shade: 'grey', italic: true });
  }

  return { rt: `~${seg.durationMinutes}`, location: clean(session.stageOrRoom), rows };
}

export function buildRunOfShowDoc(input: RunOfShowDocInput): RunOfShowDoc {
  const { eventTitle, settings, stakeholders } = input;
  const options = input.options ?? {};
  const sessions = [...input.sessions].sort((a, b) =>
    `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)
  );
  const first = sessions[0];

  // Fall back to the narrative the producer already wrote, so nothing goes missing from the export.
  const objective = clean(settings.objective) || clean(first?.stage1Narrative.themeStatement);
  const message = clean(settings.message) || clean(first?.stage1Narrative.coreMessage);
  const structure = clean(settings.structure) || clean(first?.stage1Narrative.flowHandoverNotes);
  const intro = [
    { label: 'Objective:', text: objective },
    { label: 'Message:', text: message },
    { label: 'Structure:', text: structure },
  ].filter((row) => row.text);

  const docSessions: DocSession[] = sessions.map((session, i) => {
    const speakers = new Set<string>();
    for (const seg of session.segments) for (const n of speakerNamesFor(seg, stakeholders)) speakers.add(n);
    const times = `${session.startTime} to ${session.endTime}`;
    return {
      heading: sessions.length > 1 ? `Session ${i + 1} \u2014 ${clean(session.title)}` : clean(session.title),
      dateLine: session.date ? `${formatLongDate(session.date)} - ${times}` : times,
      abstract: paragraphs(session.abstract),
      runtime: runtimeLine(session, speakers.size),
      blocks: session.segments.map((seg) => buildBlock(seg, session, stakeholders, options)),
      breakAfter: i < sessions.length - 1 ? clean(session.breakAfter) : '',
    };
  });

  const openItems: DocOpenItem[] = (input.openItems ?? [])
    .filter((t) => t.status === 'open')
    .map((t) => ({
      item: clean(t.title),
      raisedBy: clean(t.raisedBy) || '\u2013',
      status: ['Open', t.dueDate ? `due ${formatShortDate(t.dueDate)}` : ''].filter(Boolean).join(', ') + (t.notes ? `. ${clean(t.notes)}` : ''),
    }));

  return {
    title: clean(settings.title) || `${clean(eventTitle)} \u2014 Run of Show`,
    headline: clean(settings.headline),
    descriptor: clean(settings.descriptor),
    intro,
    sessions: docSessions,
    openItems,
  };
}

/* ------------------------------------------------------------------ */
/* HTML                                                                */
/* ------------------------------------------------------------------ */

export function escapeHtml(str: string): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Colours taken from the reference document. */
export const DOC_COLOURS = {
  headerBg: '#14284b',
  headerText: '#ffffff',
  blue: '#dbe5f1',
  grey: '#efefef',
  border: '#000000',
  muted: '#555555',
} as const;

const FONT = "font-family: Arial, Helvetica, sans-serif;";
const CELL = `${FONT} font-size: 8pt; line-height: 1.35; border: 1px solid ${DOC_COLOURS.border}; padding: 4px 6px; vertical-align: top;`;

function cellBg(shade: DocRow['shade']): string {
  if (shade === 'blue') return ` bgcolor="${DOC_COLOURS.blue}" style="${CELL} background-color: ${DOC_COLOURS.blue};"`;
  if (shade === 'grey') return ` bgcolor="${DOC_COLOURS.grey}" style="${CELL} background-color: ${DOC_COLOURS.grey};"`;
  return ` style="${CELL}"`;
}

function notesHtml(row: DocRow): string {
  const label = row.label ? `<b>${escapeHtml(row.label)}</b>${row.text ? ' ' : ''}` : '';
  const body = row.href
    ? `<a href="${escapeHtml(row.href)}" style="color: #1155cc;">${escapeHtml(row.text)}</a>`
    : escapeHtml(row.text);
  const inner = `${label}${body}`;
  return row.italic ? `<i>${inner}</i>` : inner;
}

function segmentCellHtml(row: DocRow): string {
  if (!row.segment) return '&nbsp;';
  const text = escapeHtml(row.segment);
  if (row.segmentStyle === 'bold') return `<b>${text}</b>`;
  if (row.segmentStyle === 'italic') return `<i>${text}</i>`;
  return text;
}

function blockHtml(block: DocBlock): string {
  const span = block.rows.length;
  return block.rows
    .map((row, i) => {
      const lead =
        i === 0
          ? `<td rowspan="${span}" valign="middle" style="${CELL} vertical-align: middle; text-align: center;">${escapeHtml(block.rt)}</td>` +
            `<td rowspan="${span}" valign="middle" style="${CELL} font-size: 7pt; vertical-align: middle;">${escapeHtml(block.location) || '&nbsp;'}</td>`
          : '';
      return `<tr>${lead}<td${cellBg(row.shade)}>${segmentCellHtml(row)}</td><td${cellBg(row.shade)}>${notesHtml(row)}</td></tr>`;
    })
    .join('');
}

const HEAD_CELL = `${FONT} font-size: 9pt; font-weight: bold; color: ${DOC_COLOURS.headerText}; background-color: ${DOC_COLOURS.headerBg}; border: 1px solid ${DOC_COLOURS.border}; padding: 4px 6px; text-align: left;`;

function headRow(labels: string[]): string {
  return `<tr>${labels.map((l) => `<td bgcolor="${DOC_COLOURS.headerBg}" style="${HEAD_CELL}">${escapeHtml(l)}</td>`).join('')}</tr>`;
}

const TABLE = `border-collapse: collapse; width: 100%; table-layout: fixed; border: 1px solid ${DOC_COLOURS.border};`;

export function renderRunOfShowHtml(doc: RunOfShowDoc): string {
  const out: string[] = [];
  out.push(`<div style="${FONT} color: #000000; font-size: 11pt; line-height: 1.4;">`);
  out.push(`<h1 style="${FONT} font-size: 20pt; font-weight: bold; margin: 0 0 6pt;">${escapeHtml(doc.title)}</h1>`);
  if (doc.headline) out.push(`<p style="margin: 0 0 3pt; font-size: 13pt;"><b>${escapeHtml(doc.headline)}</b></p>`);
  if (doc.descriptor) out.push(`<p style="margin: 0 0 10pt;"><i>${escapeHtml(doc.descriptor)}</i></p>`);

  if (doc.intro.length > 0) {
    out.push(`<table border="1" cellspacing="0" cellpadding="0" style="${TABLE} margin-bottom: 12pt;">`);
    out.push('<colgroup><col width="16%"><col width="84%"></colgroup>');
    for (const row of doc.intro) {
      out.push(
        `<tr><td style="${CELL} font-size: 10pt;"><b>${escapeHtml(row.label)}</b></td><td style="${CELL} font-size: 10pt;">${escapeHtml(row.text)}</td></tr>`
      );
    }
    out.push('</table>');
  }

  doc.sessions.forEach((session) => {
    out.push(`<h2 style="${FONT} font-size: 14pt; font-weight: bold; margin: 16pt 0 3pt;">${escapeHtml(session.heading)}</h2>`);
    out.push(`<p style="margin: 0 0 8pt;">${escapeHtml(session.dateLine)}</p>`);
    session.abstract.forEach((p, i) => {
      out.push(`<p style="margin: 0 0 6pt;">${i === 0 ? '<b>Abstract:</b> ' : ''}${escapeHtml(p)}</p>`);
    });
    out.push(`<p style="margin: 6pt 0 8pt; font-size: 8pt; color: ${DOC_COLOURS.muted};">${escapeHtml(session.runtime)}</p>`);

    out.push(`<table border="1" cellspacing="0" cellpadding="0" style="${TABLE}">`);
    out.push('<colgroup><col width="7%"><col width="14%"><col width="22%"><col width="57%"></colgroup>');
    out.push(headRow(['RT', 'Location', 'Segment', 'Notes']));
    session.blocks.forEach((block) => out.push(blockHtml(block)));
    out.push('</table>');

    if (session.breakAfter) {
      out.push(`<p style="margin: 14pt 0 0;"><b>${escapeHtml(session.breakAfter)}</b></p>`);
    }
  });

  if (doc.openItems.length > 0) {
    out.push(`<h2 style="${FONT} font-size: 14pt; font-weight: bold; margin: 18pt 0 6pt;">Open Items From Review</h2>`);
    out.push(`<table border="1" cellspacing="0" cellpadding="0" style="${TABLE}">`);
    out.push('<colgroup><col width="50%"><col width="22%"><col width="28%"></colgroup>');
    out.push(headRow(['Item', 'Raised by', 'Status']));
    for (const item of doc.openItems) {
      out.push(
        `<tr><td style="${CELL}">${escapeHtml(item.item)}</td><td style="${CELL}">${escapeHtml(item.raisedBy)}</td><td style="${CELL}">${escapeHtml(item.status)}</td></tr>`
      );
    }
    out.push('</table>');
  }

  out.push('</div>');
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

const cell = (text: string) => text.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function notesMarkdown(row: DocRow): string {
  const text = row.href ? `[${cell(row.text)}](${row.href})` : cell(row.text);
  if (row.italic) {
    // A bold label inside italics, as the reference document is written.
    return row.label ? `***${row.label}** ${text}*` : `*${text}*`;
  }
  return [row.label ? `**${row.label}**` : '', text].filter(Boolean).join(' ');
}

export function renderRunOfShowMarkdown(doc: RunOfShowDoc): string {
  const out: string[] = [];
  out.push(`# ${cell(doc.title)}`);
  if (doc.headline) out.push(`**${cell(doc.headline)}**  `);
  if (doc.descriptor) out.push(`*${cell(doc.descriptor)}*`);
  out.push('');

  if (doc.intro.length > 0) {
    out.push('|  |  |', '| :---- | :---- |');
    for (const row of doc.intro) out.push(`| **${row.label}** | ${cell(row.text)} |`);
    out.push('');
  }

  for (const session of doc.sessions) {
    out.push(`**${cell(session.heading)}**  `, session.dateLine, '');
    session.abstract.forEach((p, i) => out.push(`${i === 0 ? '**Abstract:** ' : ''}${p}`, ''));
    out.push(session.runtime, '');
    out.push('| RT | Location | Segment | Notes |', '| :---- | :---- | :---- | :---- |');
    for (const block of session.blocks) {
      block.rows.forEach((row, i) => {
        const seg =
          row.segmentStyle === 'bold' && row.segment
            ? `**${cell(row.segment)}**`
            : row.segmentStyle === 'italic' && row.segment
              ? `*${cell(row.segment)}*`
              : cell(row.segment);
        out.push(`| ${i === 0 ? cell(block.rt) : ''} | ${i === 0 ? cell(block.location) : ''} | ${seg} | ${notesMarkdown(row)} |`);
      });
    }
    out.push('');
    if (session.breakAfter) out.push(`**${cell(session.breakAfter)}**`, '');
  }

  if (doc.openItems.length > 0) {
    out.push('**Open Items From Review**', '', '| Item | Raised by | Status |', '| :---- | :---- | :---- |');
    for (const item of doc.openItems) out.push(`| ${cell(item.item)} | ${cell(item.raisedBy)} | ${cell(item.status)} |`);
    out.push('');
  }

  return out.join('\n');
}
