import { describe, it, expect } from 'vitest';
import {
  addApproval,
  addCategory,
  budgetSummary,
  budgetTotals,
  canClose,
  canDeleteCategory,
  categoryRollups,
  committedFigure,
  createEmptyBudget,
  currentFigure,
  currentFigureKind,
  formatMoney,
  latestApproval,
  normaliseBudget,
  parseMoney,
  unallocatedAmount,
  validateApproval,
} from './budget';
import type { ApprovalInput } from './budget';
import type { BudgetData, CostLine } from '@/types/budget';

const sarah = { id: 'stk_sarah', name: 'Sarah Chen' };
const NOW = new Date('2026-10-14T12:00:00');

const line = (id: string, categoryId: string, forecast: number, extra: Partial<CostLine> = {}): CostLine => ({
  id,
  categoryId,
  description: id,
  forecast,
  closed: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  ...extra,
});

function approved(total: number, allocations: Record<string, number>): BudgetData {
  return addApproval(
    createEmptyBudget(),
    { total, allocations, confirmedOn: '2026-10-03', authorisedBy: sarah },
    NOW
  );
}

describe('money', () => {
  it('parses what people actually type', () => {
    expect(parseMoney('95,000')).toBe(95000);
    expect(parseMoney('$1 250.50')).toBe(1250.5);
    expect(parseMoney('  12  ')).toBe(12);
  });
  it('accepts a currency symbol or code, and groups of three', () => {
    expect(parseMoney('£1,250.50')).toBe(1250.5);
    expect(parseMoney('USD 95,000')).toBe(95000);
    expect(parseMoney('€ 12')).toBe(12);
    expect(parseMoney('1,000,000')).toBe(1000000);
    expect(parseMoney('.5')).toBe(0.5);
    expect(parseMoney('0')).toBe(0);
  });
  it('refuses what it would have to guess at, instead of guessing', () => {
    expect(parseMoney('1e3')).toBeNull(); // was 13
    expect(parseMoney('1,2,3')).toBeNull(); // was 123
    expect(parseMoney('1.250,50')).toBeNull(); // was 1.25
    expect(parseMoney('1.005')).toBeNull(); // three decimals: not rounded silently
    expect(parseMoney('12.345.67')).toBeNull();
    expect(parseMoney('1,23')).toBeNull();
    expect(parseMoney('0.1+0.2')).toBeNull();
    expect(parseMoney('١٢٣')).toBeNull();
    expect(parseMoney('12 abc')).toBeNull();
  });
  it('has an upper limit', () => {
    expect(parseMoney('999,999,999,999.99')).toBe(999_999_999_999.99);
    expect(parseMoney('1,000,000,000,000')).toBeNull();
    expect(parseMoney('99999999999999999999')).toBeNull();
  });
  it('refuses unreadable and negative values', () => {
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('-5')).toBeNull();
    expect(parseMoney('.')).toBeNull();
  });
  it('formats in the event currency and defaults to USD', () => {
    expect(formatMoney(95000)).toBe('$95,000');
    expect(formatMoney(1250.5)).toBe('$1,250.50');
    expect(formatMoney(-0)).toBe('$0'); // never "-$0"
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(1000, 'EUR')).toBe('€1,000');
  });
});

describe('a cost line has three figures and the latest one is current', () => {
  it('forecast, then committed, then actual', () => {
    const l = line('a', 'c', 1000);
    expect(currentFigureKind(l)).toBe('forecast');
    expect(currentFigure(l)).toBe(1000);
    expect(currentFigure({ ...l, committed: 900 })).toBe(900);
    expect(currentFigure({ ...l, committed: 900, actual: 950 })).toBe(950);
  });
  it('a zero actual is a real actual, not a missing one', () => {
    expect(currentFigure(line('a', 'c', 1000, { actual: 0 }))).toBe(0);
  });
  it('committed counts committed or actual money, never forecast alone', () => {
    expect(committedFigure(line('a', 'c', 1000))).toBe(0);
    expect(committedFigure(line('a', 'c', 1000, { committed: 800 }))).toBe(800);
    expect(committedFigure(line('a', 'c', 1000, { committed: 800, actual: 750 }))).toBe(750);
  });
  it('can only be closed once it has an actual', () => {
    expect(canClose(line('a', 'c', 1000))).toBe(false);
    expect(canClose(line('a', 'c', 1000, { committed: 900 }))).toBe(false);
    expect(canClose(line('a', 'c', 1000, { actual: 0 }))).toBe(true);
  });
});

describe('approvals', () => {
  const base = createEmptyBudget();
  const valid: ApprovalInput = {
    total: 95000,
    allocations: { cat_av: 30000, cat_swag: 10000 },
    confirmedOn: '2026-10-03',
    authorisedBy: sarah,
  };

  it('accepts a complete, consistent approval', () => {
    expect(validateApproval(valid, base.categories, NOW)).toEqual([]);
  });

  it('requires a total, a date and an authoriser', () => {
    const errors = validateApproval({ ...valid, total: 0, confirmedOn: '', authorisedBy: null }, base.categories, NOW);
    expect(errors).toHaveLength(3);
  });

  it('rejects allocations that exceed the total', () => {
    const errors = validateApproval({ ...valid, allocations: { cat_av: 80000, cat_swag: 20000 } }, base.categories, NOW);
    expect(errors.join(' ')).toMatch(/more than the approved total/);
  });

  it('allows allocations to leave money unallocated, and reports how much', () => {
    expect(unallocatedAmount(95000, valid.allocations)).toBe(55000);
  });

  it('rejects a confirmed date in the future but allows today', () => {
    expect(validateApproval({ ...valid, confirmedOn: '2026-10-15' }, base.categories, NOW).join()).toMatch(/future/);
    expect(validateApproval({ ...valid, confirmedOn: '2026-10-14' }, base.categories, NOW)).toEqual([]);
  });

  it('rejects an allocation to a category that does not exist', () => {
    expect(validateApproval({ ...valid, allocations: { cat_nope: 1 } }, base.categories, NOW).join()).toMatch(/no longer exists/);
  });

  it('adds versions rather than editing, and the latest is current', () => {
    const v1 = addApproval(base, valid, NOW);
    const v2 = addApproval(v1, { ...valid, total: 120000, authorisedBy: { id: 'stk_m', name: 'Marcus Vance' } }, NOW);
    expect(v2.approvals.map((a) => a.version)).toEqual([1, 2]);
    expect(v2.approvals[0].total).toBe(95000);
    expect(latestApproval(v2)?.total).toBe(120000);
    expect(latestApproval(v2)?.authorisedBy.name).toBe('Marcus Vance');
  });

  it('clears the draft once the budget is confirmed and drops zero allocations', () => {
    const withDraft = { ...base, draft: { total: 1, allocations: {} } };
    const out = addApproval(withDraft, { ...valid, allocations: { cat_av: 0, cat_swag: 5 } }, NOW);
    expect(out.draft).toBeUndefined();
    expect(latestApproval(out)?.allocations).toEqual({ cat_swag: 5 });
  });

  it('does not mutate the original', () => {
    addApproval(base, valid, NOW);
    expect(base.approvals).toHaveLength(0);
  });
});

describe('totals', () => {
  it('has no headroom or level until a budget is approved', () => {
    const data = { ...createEmptyBudget(), lines: [line('a', 'cat_av', 500)] };
    const t = budgetTotals(data);
    expect(t).toMatchObject({ approved: null, forecast: 500, headroom: null, percentUsed: null, level: 'none' });
  });

  it('keeps the forecast total honest as actuals replace estimates', () => {
    const data: BudgetData = {
      ...approved(10000, { cat_av: 10000 }),
      lines: [
        line('a', 'cat_av', 4000, { committed: 3800, actual: 3900 }),
        line('b', 'cat_av', 3000, { committed: 2800 }),
        line('c', 'cat_av', 2000),
      ],
    };
    const t = budgetTotals(data);
    expect(t.forecast).toBe(3900 + 2800 + 2000);
    expect(t.committed).toBe(3900 + 2800);
    expect(t.actual).toBe(3900);
    expect(t.headroom).toBe(10000 - 8700);
  });

  it('flags watch from 90% and over above 100%, and 100% exactly is not over', () => {
    const at = (forecast: number) =>
      budgetTotals({ ...approved(1000, {}), lines: [line('a', 'cat_av', forecast)] }).level;
    expect(at(899)).toBe('ok');
    expect(at(900)).toBe('watch');
    expect(at(1000)).toBe('watch');
    expect(at(1001)).toBe('over');
  });

  it('avoids floating point drift', () => {
    const data = { ...approved(1, {}), lines: [line('a', 'cat_av', 0.1), line('b', 'cat_av', 0.2)] };
    expect(budgetTotals(data).forecast).toBe(0.3);
  });
});

describe('category rollups', () => {
  it('compares each category with its own approved amount', () => {
    const data: BudgetData = {
      ...approved(100000, { cat_av: 10000, cat_swag: 5000 }),
      lines: [line('a', 'cat_av', 9500), line('b', 'cat_swag', 6000)],
    };
    const by = Object.fromEntries(categoryRollups(data).map((r) => [r.category.id, r]));
    expect(by.cat_av).toMatchObject({ level: 'watch', remaining: 500, lineCount: 1 });
    expect(by.cat_swag).toMatchObject({ level: 'over', remaining: -1000 });
    expect(by.cat_catering.level).toBe('ok');
  });

  it('marks a category with costs but no approved amount', () => {
    const data = { ...approved(1000, { cat_av: 1000 }), lines: [line('a', 'cat_swag', 50)] };
    const swag = categoryRollups(data).find((r) => r.category.id === 'cat_swag')!;
    expect(swag.level).toBe('unallocated');
  });

  it('a category over its amount does not turn the whole budget red', () => {
    const data: BudgetData = {
      ...approved(100000, { cat_av: 1000 }),
      lines: [line('a', 'cat_av', 2000)],
    };
    expect(categoryRollups(data).find((r) => r.category.id === 'cat_av')!.level).toBe('over');
    expect(budgetTotals(data).level).toBe('ok');
  });

  it('has no levels before approval', () => {
    const data = { ...createEmptyBudget(), lines: [line('a', 'cat_av', 50)] };
    expect(categoryRollups(data).every((r) => r.level === 'none')).toBe(true);
  });
});

describe('categories', () => {
  it('adds a category once, case-insensitively', () => {
    const d = addCategory(createEmptyBudget(), 'Photography');
    expect(d.categories.at(-1)).toEqual({ id: 'cat_photography', name: 'Photography' });
    expect(addCategory(d, 'photography')).toBe(d);
    expect(addCategory(d, '   ')).toBe(d);
  });

  it('will not delete a category that is in use', () => {
    const base = approved(1000, { cat_av: 500 });
    expect(canDeleteCategory(base, 'cat_av')).toBe(false); // allocated
    expect(canDeleteCategory(base, 'cat_swag')).toBe(true);
    expect(canDeleteCategory({ ...base, lines: [line('a', 'cat_swag', 1)] }, 'cat_swag')).toBe(false); // has a line
  });
});

describe('overview summary', () => {
  it('not started when empty', () => {
    expect(budgetSummary(createEmptyBudget())).toMatchObject({ state: 'not_started', headline: 'No budget set' });
  });

  it('in progress but flagged when there are costs and no authorised budget', () => {
    const s = budgetSummary({ ...createEmptyBudget(), lines: [line('a', 'cat_av', 500)] });
    expect(s.state).toBe('in_progress');
    expect(s.attention[0].label).toMatch(/not been authorised/);
  });

  it('reports a healthy budget in progress', () => {
    const s = budgetSummary({ ...approved(10000, { cat_av: 10000 }), lines: [line('a', 'cat_av', 4000)] });
    expect(s).toMatchObject({ state: 'in_progress', headline: '$4,000 forecast of $10,000 (40%)', attention: [] });
  });

  it('needs attention, critically, when over budget', () => {
    const s = budgetSummary({ ...approved(1000, { cat_av: 1000 }), lines: [line('a', 'cat_av', 1500)] });
    expect(s.state).toBe('needs_attention');
    expect(s.attention[0]).toMatchObject({ severity: 'critical' });
    expect(s.attention[0].label).toMatch(/\$500 over/);
  });

  it('lists categories that are over while the total is fine, as warnings', () => {
    const s = budgetSummary({
      ...approved(100000, { cat_av: 1000 }),
      lines: [line('a', 'cat_av', 2000)],
    });
    expect(s.state).toBe('needs_attention');
    expect(s.attention).toEqual([{ label: 'AV is $1,000 over its amount', severity: 'warning' }]);
  });

  it('is complete when every line is closed and nothing needs attention', () => {
    const s = budgetSummary({
      ...approved(10000, { cat_av: 10000 }),
      lines: [line('a', 'cat_av', 4000, { actual: 3900, closed: true })],
    });
    expect(s.state).toBe('complete');
  });
});

describe('normaliseBudget', () => {
  it('fills the gaps in a partial or missing copy', () => {
    expect(normaliseBudget(null)).toEqual(createEmptyBudget());
    const n = normaliseBudget({ currency: 'GBP', lines: [line('a', 'cat_av', 1)] } as Partial<BudgetData>);
    expect(n.currency).toBe('GBP');
    expect(n.approvals).toEqual([]);
    expect(n.categories.length).toBeGreaterThan(0);
    expect(n.lines).toHaveLength(1);
  });
});
