import { describe, it, expect } from 'vitest';
import {
  categoryTitle, checkUrl, createResource, filterResources, groupByCategory, normaliseResources, ownerRemoved,
  resourceCategories, resourcesSummary,
} from './resources';
import { ADMIN_MODULES } from '@/data/adminModules';
import type { ResourceItem } from '@/types/resources';
import type { KeyStakeholder } from '@/types';

const sarah = { id: 'stk_sarah', name: 'Sarah Chen' };
const marcus = { id: 'stk_marcus', name: 'Marcus Vance' };
const NOW = new Date('2026-10-14T12:00:00');
const ok = <T,>(r: { ok: boolean; data?: T; error?: string }): T => { if (r.ok !== true) throw new Error(r.error); return r.data as T; };
const make = (title: string, categoryId: string, owner = sarah, extra = {}) =>
  ok(createResource({ title, url: 'https://docs.google.com/document/d/x', categoryId, owner, ...extra }, NOW));
const person = (id: string): KeyStakeholder => ({ id, eventId: 'e', firstName: 'A', lastName: 'B', email: 'a@x.com', team: '', involvedWith: [], createdAt: '' });

describe('categories are the hub modules', () => {
  it('has one category for each module, using the module\'s own title, in the hub\'s order', () => {
    const modules = ADMIN_MODULES.filter((m) => m.id !== 'overview' && m.id !== 'resources');
    expect(resourceCategories()).toEqual(modules.map((m) => ({ id: m.id, title: m.title })));
  });
  it('includes the modules that matter here, and leaves out Overview and Resources itself', () => {
    const titles = resourceCategories().map((c) => c.title);
    for (const t of ['Budget', 'Schedule', 'Key Stakeholders', 'Badging & Registration', 'Keynote / General Session', 'Other']) expect(titles).toContain(t);
    expect(titles).not.toContain('Overview');
    expect(titles).not.toContain('Resources');
  });
  it('reads a title from the module, and says so when the module is gone', () => {
    expect(categoryTitle('budget')).toBe('Budget');
    expect(categoryTitle('nothing')).toBe('Unknown category');
  });
});

describe('creating a resource', () => {
  it('keeps the title, a tidied link, the category and the stakeholder', () => {
    const r = make('  Floor plan ', 'expo-booths', marcus, { notes: ' latest ' });
    expect(r).toMatchObject({ title: 'Floor plan', categoryId: 'expo-booths', owner: marcus, notes: 'latest', url: 'https://docs.google.com/document/d/x' });
    expect(ok(createResource({ title: 'x', url: 'example.com/a', categoryId: 'budget', owner: sarah })).url).toBe('https://example.com/a');
  });
  it('needs a title, a safe link, a real category and a key stakeholder', () => {
    const base = { title: 'x', url: 'https://example.com', categoryId: 'budget', owner: sarah };
    expect((createResource({ ...base, title: '  ' }) as { error: string }).error).toMatch(/title/);
    expect((createResource({ ...base, url: 'javascript:alert(1)' }) as { error: string }).error).toMatch(/http/);
    expect((createResource({ ...base, url: '' }) as { error: string }).error).toMatch(/link/i);
    expect((createResource({ ...base, categoryId: 'made-up' }) as { error: string }).error).toMatch(/category/);
    expect((createResource({ ...base, categoryId: 'overview' }) as { error: string }).error).toMatch(/category/);
    expect((createResource({ ...base, owner: null }) as { error: string }).error).toMatch(/key stakeholder/);
  });
  it('checks a changed link the same way', () => {
    expect(checkUrl('example.com/b')).toEqual({ url: 'https://example.com/b' });
    expect(checkUrl('data:text/html,hi')).toHaveProperty('error');
  });
});

describe('finding resources', () => {
  const list = [make('Budget template', 'budget', sarah), make('Run of show', 'keynote-general-session', marcus), make('Vendor quotes', 'budget', marcus, { notes: 'AV and drayage' })];
  it('filters by category, stakeholder and text, together', () => {
    expect(filterResources(list, { categoryId: 'budget' }).map((r) => r.title)).toEqual(['Budget template', 'Vendor quotes']);
    expect(filterResources(list, { ownerId: 'stk_marcus' })).toHaveLength(2);
    expect(filterResources(list, { categoryId: 'budget', ownerId: 'stk_marcus' }).map((r) => r.title)).toEqual(['Vendor quotes']);
    expect(filterResources(list, { query: 'DRAYAGE' }).map((r) => r.title)).toEqual(['Vendor quotes']);
    expect(filterResources(list, { query: 'keynote' }).map((r) => r.title)).toEqual(['Run of show']); // matches the category name too
    expect(filterResources(list, {})).toHaveLength(3);
  });
  it('groups by category in the hub\'s order, sorted by title, leaving empty categories out', () => {
    const g = groupByCategory([make('Zed', 'budget'), make('Alpha', 'budget'), make('Plan', 'expo-booths')]);
    expect(g.map((x) => x.category.title)).toEqual(['Expo Booths', 'Budget']);
    expect(g[1].resources.map((r) => r.title)).toEqual(['Alpha', 'Zed']);
  });
  it('keeps a resource visible when its module has gone', () => {
    const lost: ResourceItem = { ...make('Old', 'budget'), categoryId: 'gone' };
    const g = groupByCategory([lost]);
    expect(g).toHaveLength(1);
    expect(g[0].category.title).toBe('Unknown category');
  });
  it('flags a stakeholder who has been removed', () => {
    expect(ownerRemoved(make('x', 'budget', sarah), [person('stk_sarah')])).toBe(false);
    expect(ownerRemoved(make('x', 'budget', sarah), [person('stk_other')])).toBe(true);
  });
  it('copes with missing stored data', () => {
    expect(normaliseResources(null)).toEqual({ resources: [] });
    expect(normaliseResources({} as never)).toEqual({ resources: [] });
  });
});

describe('overview summary', () => {
  it('not started when empty', () => {
    expect(resourcesSummary({ resources: [] }, [])).toMatchObject({ state: 'not_started', headline: 'No resources yet' });
  });
  it('counts resources and categories', () => {
    const s = resourcesSummary({ resources: [make('a', 'budget'), make('b', 'budget'), make('c', 'schedule')] }, [person('stk_sarah')]);
    expect(s).toMatchObject({ state: 'in_progress', headline: '3 resources in 2 categories', attention: [] });
    expect(resourcesSummary({ resources: [make('a', 'budget')] }, [person('stk_sarah')]).headline).toBe('1 resource in 1 category');
  });
  it('needs attention when a stakeholder was removed or a category is gone', () => {
    const lost: ResourceItem = { ...make('Old', 'budget'), categoryId: 'gone' };
    const s = resourcesSummary({ resources: [make('a', 'budget'), lost] }, [person('stk_other')]);
    expect(s.state).toBe('needs_attention');
    expect(s.attention.map((a) => a.label)).toEqual(['2 resources have a stakeholder who was removed', '1 resource is in a category that no longer exists']);
  });
});
