/**
 * The contract every module meets so the Overview module can report on it.
 * A module returns this from a small pure function over its own data; the
 * Overview renders them side by side and never reaches into module internals.
 */
export type ModuleState = 'not_started' | 'in_progress' | 'needs_attention' | 'complete';

export interface ModuleAttentionItem {
  label: string;
  severity: 'warning' | 'critical';
}

export interface ModuleSummary {
  moduleId: string;
  state: ModuleState;
  /** One line a person can read at a glance, e.g. "$91,200 forecast of $95,000 (96%)". */
  headline: string;
  attention: ModuleAttentionItem[];
}
