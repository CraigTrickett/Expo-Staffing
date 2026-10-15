import type {
  BudgetApproval,
  BudgetCategory,
  BudgetData,
  CostLine,
} from '@/types/budget';
import type { StakeholderRef } from '@/types/stakeholderRef';
import type { ModuleAttentionItem, ModuleSummary } from '@/types/moduleSummary';

export const DEFAULT_CURRENCY = 'USD';
/** Forecast at or above this share of an amount is flagged as close to it. */
export const WATCH_AT = 0.9;

export const DEFAULT_CATEGORY_NAMES = [
  'Booth Space',
  'Drayage',
  'AV',
  'Swag',
  'Travel & Lodging',
  'Catering',
  'Marketing',
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function createEmptyBudget(): BudgetData {
  return {
    currency: DEFAULT_CURRENCY,
    categories: DEFAULT_CATEGORY_NAMES.map((name) => ({ id: `cat_${slugify(name)}`, name })),
    approvals: [],
    lines: [],
  };
}

/** Fills anything missing from a stored or remote copy, so older or partial data still loads. */
export function normaliseBudget(raw: Partial<BudgetData> | null | undefined): BudgetData {
  const empty = createEmptyBudget();
  if (!raw) return empty;
  return {
    currency: raw.currency || empty.currency,
    categories: Array.isArray(raw.categories) && raw.categories.length > 0 ? raw.categories : empty.categories,
    approvals: Array.isArray(raw.approvals) ? raw.approvals : [],
    draft: raw.draft,
    lines: Array.isArray(raw.lines) ? raw.lines : [],
  };
}

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

/** Accepts "95,000", "$95000", " 1 250.50 " and so on. Returns null for anything unreadable or negative. */
/** The largest amount accepted: a trillion is more than any budget here, and keeps every total exact. */
export const MAX_AMOUNT = 999_999_999_999.99;

// Plain (1250.5) or grouped in threes (1,250.50 or 1 250.50), with at most two decimals.
const AMOUNT = /^(?:\d{1,3}(?:[, \u00a0]\d{3})+|\d+)?(?:\.\d{1,2})?$/;

/**
 * An amount typed by a person, or null if it is not clearly one. A leading currency symbol or code is
 * fine. Anything it would have to guess at is refused instead: 1e3, 1,2,3, a decimal comma (1.250,50),
 * more than two decimals, a negative, or more than MAX_AMOUNT.
 */
export function parseMoney(input: string): number | null {
  const text = input.trim().replace(/^(?:[$£€¥]|[A-Za-z]{3})\s*/, '');
  if (!/\d/.test(text) || !AMOUNT.test(text)) return null;
  const n = Number(text.replace(/[, \u00a0]/g, ''));
  if (!Number.isFinite(n) || n > MAX_AMOUNT) return null;
  return round2(n);
}

/** Whole amounts show without cents ($95,000); anything with cents shows both digits ($1,250.50). */
export function formatMoney(rawAmount: number, currency: string = DEFAULT_CURRENCY): string {
  const amount = rawAmount === 0 ? 0 : rawAmount; // turns -0 into 0, so it never shows as -$0
  const digits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString('en-US')}`;
  }
}

/** Plain digits with thousands separators, for use inside an input. */
export function formatMoneyInput(amount: number | undefined): string {
  if (amount === undefined || amount === null) return '';
  return amount.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/* ------------------------------------------------------------------ */
/* Cost lines                                                          */
/* ------------------------------------------------------------------ */

export type FigureKind = 'forecast' | 'committed' | 'actual';

/** Which figure is current for a line: the latest one that exists. */
export function currentFigureKind(line: CostLine): FigureKind {
  if (line.actual !== undefined) return 'actual';
  if (line.committed !== undefined) return 'committed';
  return 'forecast';
}

export function currentFigure(line: CostLine): number {
  return line[currentFigureKind(line)] ?? line.forecast;
}

/** Money spent or contractually committed. Forecast alone does not count. */
export function committedFigure(line: CostLine): number {
  return line.actual ?? line.committed ?? 0;
}

/** A line can only be closed once it has an actual: closing makes that figure final. */
export function canClose(line: CostLine): boolean {
  return line.actual !== undefined;
}

/* ------------------------------------------------------------------ */
/* Approvals                                                           */
/* ------------------------------------------------------------------ */

export function latestApproval(data: BudgetData): BudgetApproval | null {
  if (data.approvals.length === 0) return null;
  return data.approvals.reduce((a, b) => (b.version > a.version ? b : a));
}

export function sumAllocations(allocations: Record<string, number>): number {
  return Object.values(allocations).reduce((sum, n) => sum + (n || 0), 0);
}

export function unallocatedAmount(total: number, allocations: Record<string, number>): number {
  return round2(total - sumAllocations(allocations));
}

export interface ApprovalInput {
  total: number;
  allocations: Record<string, number>;
  confirmedOn: string;
  authorisedBy: StakeholderRef | null;
  reference?: string;
  note?: string;
}

const todayIso = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

export function validateApproval(
  input: ApprovalInput,
  categories: BudgetCategory[],
  now: Date = new Date()
): string[] {
  const errors: string[] = [];
  if (!(input.total > 0)) errors.push('Enter the approved total.');

  const known = new Set(categories.map((c) => c.id));
  for (const [id, amount] of Object.entries(input.allocations)) {
    if (!known.has(id)) errors.push('An allocation refers to a category that no longer exists.');
    if (amount < 0) errors.push('Allocations cannot be negative.');
  }
  if (input.total > 0 && unallocatedAmount(input.total, input.allocations) < 0) {
    errors.push('Category amounts add up to more than the approved total.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.confirmedOn)) {
    errors.push('Enter the date the budget was confirmed.');
  } else if (input.confirmedOn > todayIso(now)) {
    errors.push('The confirmed date cannot be in the future.');
  }

  if (!input.authorisedBy) errors.push('Choose who authorised the budget.');
  return errors;
}

/** Adds the next approval version. The caller validates first. */
export function addApproval(data: BudgetData, input: ApprovalInput, now: Date = new Date()): BudgetData {
  if (!input.authorisedBy) throw new Error('addApproval needs an authoriser');
  const version = (latestApproval(data)?.version ?? 0) + 1;
  const approval: BudgetApproval = {
    id: `appr_${now.getTime()}`,
    version,
    total: input.total,
    allocations: Object.fromEntries(
      Object.entries(input.allocations).filter(([, amount]) => amount > 0)
    ),
    confirmedOn: input.confirmedOn,
    authorisedBy: input.authorisedBy,
    reference: input.reference?.trim() || undefined,
    note: input.note?.trim() || undefined,
    recordedAt: now.toISOString(),
  };
  return { ...data, approvals: [...data.approvals, approval], draft: undefined };
}

/* ------------------------------------------------------------------ */
/* Rollups                                                             */
/* ------------------------------------------------------------------ */

export type Level = 'none' | 'ok' | 'watch' | 'over';

function levelFor(forecast: number, approved: number): Level {
  if (forecast > approved) return 'over';
  if (approved > 0 && forecast >= approved * WATCH_AT) return 'watch';
  return 'ok';
}

export interface BudgetTotals {
  approved: number | null;
  forecast: number;
  committed: number;
  actual: number;
  /** Approved minus forecast. Negative means over. Null when nothing is approved. */
  headroom: number | null;
  /** Forecast as a share of approved. Null when nothing is approved. */
  percentUsed: number | null;
  level: Level;
}

export function budgetTotals(data: BudgetData): BudgetTotals {
  const approval = latestApproval(data);
  const forecast = round2(data.lines.reduce((s, l) => s + currentFigure(l), 0));
  const committed = round2(data.lines.reduce((s, l) => s + committedFigure(l), 0));
  const actual = round2(data.lines.reduce((s, l) => s + (l.actual ?? 0), 0));
  if (!approval) {
    return { approved: null, forecast, committed, actual, headroom: null, percentUsed: null, level: 'none' };
  }
  return {
    approved: approval.total,
    forecast,
    committed,
    actual,
    headroom: round2(approval.total - forecast),
    percentUsed: approval.total > 0 ? forecast / approval.total : null,
    level: levelFor(forecast, approval.total),
  };
}

export type CategoryLevel = 'none' | 'ok' | 'watch' | 'over' | 'unallocated';

export interface CategoryRollup {
  category: BudgetCategory;
  approved: number;
  forecast: number;
  committed: number;
  actual: number;
  /** Approved minus forecast. */
  remaining: number;
  percentUsed: number | null;
  level: CategoryLevel;
  lineCount: number;
}

export function categoryRollups(data: BudgetData): CategoryRollup[] {
  const approval = latestApproval(data);
  return data.categories.map((category) => {
    const lines = data.lines.filter((l) => l.categoryId === category.id);
    const forecast = round2(lines.reduce((s, l) => s + currentFigure(l), 0));
    const committed = round2(lines.reduce((s, l) => s + committedFigure(l), 0));
    const actual = round2(lines.reduce((s, l) => s + (l.actual ?? 0), 0));
    const approved = approval?.allocations[category.id] ?? 0;

    let level: CategoryLevel = 'none';
    if (approval) {
      if (approved === 0) level = forecast > 0 ? 'unallocated' : 'ok';
      else level = levelFor(forecast, approved);
    }

    return {
      category,
      approved,
      forecast,
      committed,
      actual,
      remaining: round2(approved - forecast),
      percentUsed: approved > 0 ? forecast / approved : null,
      level,
      lineCount: lines.length,
    };
  });
}

/** Rounds to cents. The epsilon stops 1.005 landing on 1.00 through binary floating point. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export function addCategory(data: BudgetData, name: string): BudgetData {
  const trimmed = name.trim();
  if (!trimmed) return data;
  if (data.categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) return data;
  let id = `cat_${slugify(trimmed) || 'category'}`;
  while (data.categories.some((c) => c.id === id)) id += '_2';
  return { ...data, categories: [...data.categories, { id, name: trimmed }] };
}

/** A category can go only when nothing refers to it: no lines, and no money allocated in any approval. */
export function canDeleteCategory(data: BudgetData, categoryId: string): boolean {
  if (data.lines.some((l) => l.categoryId === categoryId)) return false;
  if (data.approvals.some((a) => (a.allocations[categoryId] ?? 0) > 0)) return false;
  return true;
}

/* ------------------------------------------------------------------ */
/* Overview summary                                                    */
/* ------------------------------------------------------------------ */

export function budgetSummary(data: BudgetData): ModuleSummary {
  const approval = latestApproval(data);
  const totals = budgetTotals(data);
  const attention: ModuleAttentionItem[] = [];
  const money = (n: number) => formatMoney(n, data.currency);

  if (!approval) {
    const started = data.lines.length > 0 || !!data.draft;
    if (started) attention.push({ label: 'Budget has not been authorised yet', severity: 'warning' });
    return {
      moduleId: 'budget',
      state: started ? 'in_progress' : 'not_started',
      headline: started
        ? `${money(totals.forecast)} forecast, no approved budget`
        : 'No budget set',
      attention,
    };
  }

  if (totals.level === 'over') {
    attention.push({
      label: `Forecast is ${money(Math.abs(totals.headroom ?? 0))} over the approved budget`,
      severity: 'critical',
    });
  } else if (totals.level === 'watch') {
    attention.push({ label: 'Forecast is within 10% of the approved budget', severity: 'warning' });
  }

  const overCategories = categoryRollups(data).filter((c) => c.level === 'over' || c.level === 'unallocated');
  for (const c of overCategories.slice(0, 3)) {
    attention.push({
      label:
        c.level === 'unallocated'
          ? `${c.category.name} has costs but no approved amount`
          : `${c.category.name} is ${money(Math.abs(c.remaining))} over its amount`,
      severity: 'warning',
    });
  }

  const pct = totals.percentUsed === null ? '' : ` (${Math.round(totals.percentUsed * 100)}%)`;
  const allClosed = data.lines.length > 0 && data.lines.every((l) => l.closed);
  const state =
    attention.length > 0 ? 'needs_attention' : allClosed ? 'complete' : 'in_progress';

  return {
    moduleId: 'budget',
    state,
    headline: `${money(totals.forecast)} forecast of ${money(approval.total)}${pct}`,
    attention,
  };
}
