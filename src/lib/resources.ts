import type { ResourceItem, ResourcesData } from '@/types/resources';
import type { StakeholderRef } from '@/types/stakeholderRef';
import type { ModuleAttentionItem, ModuleSummary } from '@/types/moduleSummary';
import type { KeyStakeholder } from '@/types';
import { ADMIN_MODULES } from '@/data/adminModules';
import { isLinkFailure, parseLink } from './links';

export const RESOURCES_MODULE_ID = 'resources';

export const createEmptyResources = (): ResourcesData => ({ resources: [] });

export function normaliseResources(raw: Partial<ResourcesData> | null | undefined): ResourcesData {
  return { resources: Array.isArray(raw?.resources) ? raw!.resources! : [] };
}

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export interface ResourceCategory {
  id: string;
  /** The module's own title, so a category always reads the way the hub does. */
  title: string;
}

/** Overview is a dashboard and Resources is this module: neither is somewhere a resource belongs. */
const NOT_CATEGORIES = new Set(['overview', RESOURCES_MODULE_ID]);

/** One category per hub module, in the hub's order. Titles are read from the modules at the moment of asking. */
export const resourceCategories = (): ResourceCategory[] =>
  ADMIN_MODULES.filter((m) => !NOT_CATEGORIES.has(m.id)).map((m) => ({ id: m.id, title: m.title }));

export const DEFAULT_CATEGORY_ID = 'other';

export function categoryTitle(categoryId: string): string {
  return resourceCategories().find((c) => c.id === categoryId)?.title ?? 'Unknown category';
}

/* ------------------------------------------------------------------ */
/* Creating and changing                                               */
/* ------------------------------------------------------------------ */

export interface ResourceInput {
  title: string;
  url: string;
  categoryId: string;
  owner: StakeholderRef | null | undefined;
  notes?: string;
}

export type ResourceResult<T> = { ok: true; data: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export function createResource(input: ResourceInput, now: Date = new Date()): ResourceResult<ResourceItem> {
  const title = input.title.trim();
  if (!title) return fail('Give the resource a title.');
  const link = parseLink(input.url);
  if (isLinkFailure(link)) return fail(link.error);
  if (!resourceCategories().some((c) => c.id === input.categoryId)) return fail('Choose a category.');
  if (!input.owner) return fail('Choose the key stakeholder for this resource.');
  return {
    ok: true,
    data: {
      id: `res_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      title,
      url: link.url,
      categoryId: input.categoryId,
      owner: input.owner,
      notes: input.notes?.trim() || undefined,
      createdAt: now.toISOString(),
    },
  };
}

/** A new link for an existing resource, or null with the reason it was refused. */
export function checkUrl(url: string): { url: string } | { error: string } {
  const link = parseLink(url);
  return isLinkFailure(link) ? { error: link.error } : { url: link.url };
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

export interface ResourceFilter {
  categoryId?: string;
  ownerId?: string;
  query?: string;
}

export function filterResources(resources: ResourceItem[], filter: ResourceFilter): ResourceItem[] {
  const q = filter.query?.trim().toLowerCase();
  return resources.filter(
    (r) =>
      (!filter.categoryId || r.categoryId === filter.categoryId) &&
      (!filter.ownerId || r.owner.id === filter.ownerId) &&
      (!q || `${r.title} ${r.owner.name} ${r.notes ?? ''} ${categoryTitle(r.categoryId)}`.toLowerCase().includes(q))
  );
}

export interface ResourceGroup {
  category: ResourceCategory;
  resources: ResourceItem[];
}

/** Resources under their category, in the hub's order, each group sorted by title. Empty categories are left out. */
export function groupByCategory(resources: ResourceItem[]): ResourceGroup[] {
  const known = resourceCategories();
  const groups: ResourceGroup[] = known
    .map((category) => ({ category, resources: resources.filter((r) => r.categoryId === category.id) }))
    .filter((g) => g.resources.length > 0);
  // A resource whose module has since gone from the hub is kept visible, not lost.
  const orphans = resources.filter((r) => !known.some((c) => c.id === r.categoryId));
  if (orphans.length > 0) groups.push({ category: { id: '__unknown', title: 'Unknown category' }, resources: orphans });
  return groups.map((g) => ({ ...g, resources: [...g.resources].sort((a, b) => a.title.localeCompare(b.title)) }));
}

/** Stakeholders who still exist, so the ones who were removed can be flagged. */
export const ownerRemoved = (r: ResourceItem, stakeholders: KeyStakeholder[]): boolean => !stakeholders.some((s) => s.id === r.owner.id);

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function resourcesSummary(data: ResourcesData, stakeholders: KeyStakeholder[]): ModuleSummary {
  const id = RESOURCES_MODULE_ID;
  const list = data.resources;
  if (list.length === 0) return { moduleId: id, state: 'not_started', headline: 'No resources yet', attention: [] };

  const attention: ModuleAttentionItem[] = [];
  const orphaned = list.filter((r) => ownerRemoved(r, stakeholders)).length;
  if (orphaned > 0) {
    attention.push({ label: `${plural(orphaned, 'resource has', 'resources have')} a stakeholder who was removed`, severity: 'warning' });
  }
  const unknown = list.filter((r) => categoryTitle(r.categoryId) === 'Unknown category').length;
  if (unknown > 0) attention.push({ label: `${plural(unknown, 'resource is', 'resources are')} in a category that no longer exists`, severity: 'warning' });

  const categories = new Set(list.map((r) => r.categoryId)).size;
  return {
    moduleId: id,
    state: attention.length > 0 ? 'needs_attention' : 'in_progress',
    headline: `${plural(list.length, 'resource', 'resources')} in ${plural(categories, 'category', 'categories')}`,
    attention,
  };
}
