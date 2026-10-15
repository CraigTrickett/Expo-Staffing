import type { StakeholderRef } from './stakeholderRef';

export interface BudgetCategory {
  id: string;
  name: string;
}

/**
 * One confirmation of the budget. Approvals are append-only: raising or cutting
 * the budget adds a new version rather than editing an old one, so the history
 * of who authorised what, and when, is never lost. The latest version is current.
 */
export interface BudgetApproval {
  id: string;
  version: number;
  total: number;
  /** Approved amount per category, keyed by category id. Their sum never exceeds total. */
  allocations: Record<string, number>;
  /** YYYY-MM-DD */
  confirmedOn: string;
  authorisedBy: StakeholderRef;
  reference?: string;
  note?: string;
  recordedAt: string;
}

/** Working figures that have not been authorised yet. */
export interface BudgetDraft {
  total: number;
  allocations: Record<string, number>;
}

export interface CostLine {
  id: string;
  categoryId: string;
  description: string;
  vendor?: string;
  owner?: StakeholderRef;
  /** Your estimate. Always present. */
  forecast: number;
  /** Quote accepted or PO raised. */
  committed?: number;
  /** Invoiced or paid. */
  actual?: number;
  /** Closed means the actual is final. */
  closed: boolean;
  invoiceDate?: string;
  dueDate?: string;
  poNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface BudgetData {
  /** ISO 4217 code. One currency per event. */
  currency: string;
  categories: BudgetCategory[];
  approvals: BudgetApproval[];
  draft?: BudgetDraft;
  lines: CostLine[];
}
