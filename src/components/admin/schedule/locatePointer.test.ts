import { describe, it, expect } from 'vitest';
import { GUTTER, PX_PER_MIN, locatePointer } from './AgendaPanel';

// Three rooms, each 150px wide after a 56px gutter, on a day that starts at 08:00 (480 minutes).
const rect = { left: 100, top: 40, width: GUTTER + 450 };
const base = { rect, roomCount: 3, dayStartMin: 480, slotMinutes: 15, grabOffsetMin: 0 };
const at = (col: number, minutesIntoDay: number, extra: Partial<Parameters<typeof locatePointer>[0]> = {}) =>
  locatePointer({ ...base, clientX: rect.left + GUTTER + col * 150 + 75, clientY: rect.top + minutesIntoDay * PX_PER_MIN, ...extra });

describe('locatePointer', () => {
  it('maps the pointer to a room column', () => {
    expect([0, 1, 2].map((c) => at(c, 0).column)).toEqual([0, 1, 2]);
  });
  it('clamps to the first and last room when the pointer is in the gutter or past the edge', () => {
    expect(locatePointer({ ...base, clientX: rect.left + 10, clientY: rect.top }).column).toBe(0);
    expect(locatePointer({ ...base, clientX: rect.left + GUTTER + 9999, clientY: rect.top }).column).toBe(2);
  });
  it('maps height to a time from the start of the day', () => {
    expect(at(0, 0).startMin).toBe(480);
    expect(at(0, 120).startMin).toBe(600); // 10:00
  });
  it('snaps to the nearest slot, rounding half up', () => {
    expect(at(0, 7).startMin).toBe(480 + 0); // 7 minutes is nearer 0 than 15
    expect(at(0, 8).startMin).toBe(480 + 15); // 8 minutes is nearer 15
    expect(at(0, 127).startMin).toBe(600); // 10:07 -> 10:00
    expect(at(0, 128).startMin).toBe(615); // 10:08 -> 10:15
  });
  it('honours the snap size', () => {
    expect(at(0, 20, { slotMinutes: 30 }).startMin).toBe(480 + 30);
    expect(at(0, 14, { slotMinutes: 5 }).startMin).toBe(480 + 15);
  });
  it('takes off the grab offset, so a block lands where its top was, not where the pointer is', () => {
    // pointer 30 minutes into the day, but the block was grabbed 30 minutes down from its top
    expect(at(0, 30, { grabOffsetMin: 30 }).startMin).toBe(480);
  });
  it('can return times before the day starts, so the caller can refuse them', () => {
    expect(at(0, -30).startMin).toBe(450);
  });
});

describe('locatePointer with slot snapping', () => {
  const slot = (pointerMin: number) => (pointerMin >= 660 && pointerMin < 720 ? 660 : 0); // a 11:00 to 12:00 slot
  const snap = (pointerMin: number, topMin: number) => slot(pointerMin) || 480 + Math.round((topMin - 480) / 15) * 15;
  it('lands at the slot start wherever in the slot the pointer is', () => {
    const early = locatePointer({ ...base, clientX: rect.left + GUTTER + 10, clientY: rect.top + (661 - 480) * PX_PER_MIN, snap });
    const late = locatePointer({ ...base, clientX: rect.left + GUTTER + 10, clientY: rect.top + (719 - 480) * PX_PER_MIN, snap });
    expect([early.startMin, late.startMin]).toEqual([660, 660]);
  });
  it('uses the pointer, not the block top, to choose the slot', () => {
    // grabbed 40 minutes down, so the block top is above the slot while the pointer is inside it
    const r = locatePointer({ ...base, grabOffsetMin: 40, clientX: rect.left + GUTTER + 10, clientY: rect.top + (670 - 480) * PX_PER_MIN, snap });
    expect(r.startMin).toBe(660);
  });
  it('falls back to the grid outside any slot', () => {
    const r = locatePointer({ ...base, clientX: rect.left + GUTTER + 10, clientY: rect.top + (607 - 480) * PX_PER_MIN, snap });
    expect(r.startMin).toBe(600);
  });
});
