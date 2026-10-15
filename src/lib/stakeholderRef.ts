import type { KeyStakeholder } from '@/types';
import type { StakeholderRef } from '@/types/stakeholderRef';

export function fullName(s: Pick<KeyStakeholder, 'firstName' | 'lastName'>): string {
  return `${s.firstName} ${s.lastName}`.trim();
}

export function toStakeholderRef(s: KeyStakeholder): StakeholderRef {
  return { id: s.id, name: fullName(s) };
}

export interface ResolvedStakeholderRef {
  /** Current name when the stakeholder still exists, otherwise the stored snapshot. */
  name: string;
  /** True when the stakeholder has since been removed. */
  removed: boolean;
  stakeholder?: KeyStakeholder;
}

export function resolveStakeholderRef(
  ref: StakeholderRef | null | undefined,
  stakeholders: KeyStakeholder[]
): ResolvedStakeholderRef | null {
  if (!ref) return null;
  const match = stakeholders.find((s) => s.id === ref.id);
  if (match) return { name: fullName(match), removed: false, stakeholder: match };
  return { name: ref.name, removed: true };
}

/** "Sarah Chen" or "Sarah Chen (removed)". */
export function describeStakeholderRef(ref: StakeholderRef | null | undefined, stakeholders: KeyStakeholder[]): string {
  const resolved = resolveStakeholderRef(ref, stakeholders);
  if (!resolved) return '';
  return resolved.removed ? `${resolved.name} (removed)` : resolved.name;
}
