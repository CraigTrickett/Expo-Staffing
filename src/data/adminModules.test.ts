import { describe, it, expect } from 'vitest';
import { ADMIN_MODULES } from './adminModules';

describe('ADMIN_MODULES', () => {
  it('contains all requested module cards', () => {
    const titles = ADMIN_MODULES.map((m) => m.title);

    expect(titles).toContain('Expo Booths');
    expect(titles).toContain('Key Stakeholders');
    expect(titles).toContain('Deadlines');
    expect(titles).not.toContain('Dead lines');
    expect(titles).toContain('Sponsorship');
    expect(titles).toContain('Swag');
    expect(titles).toContain('Keynote / General Session');
    expect(titles).toContain('Schedule');
    expect(titles).toContain('Resources');
    expect(titles).toContain('Social Event');
    expect(titles).toContain('Budget');
    expect(titles).toContain('Marketing');
    expect(titles).toContain('Badging & Registration');
    expect(titles).toContain('Catering & Hospitality');
    expect(titles).toContain('Overview');
    expect(titles).toContain('Other');
    expect(titles).not.toContain('Vendor & Freight Logistics');
    expect(titles).not.toContain('Security & Emergency');
  });

  it('gives every module an id, a title, a short line and an icon, and no two share an id', () => {
    for (const mod of ADMIN_MODULES) {
      expect(mod.id).toBeTruthy();
      expect(mod.title).toBeTruthy();
      expect(mod.subtitle).toBeTruthy();
      expect(mod.iconName).toBeTruthy();
      expect(['active', 'coming_soon']).toContain(mod.status);
    }
    expect(new Set(ADMIN_MODULES.map((m) => m.id)).size).toBe(ADMIN_MODULES.length);
  });

  it('keeps each module to a title and one short line, with no claims about features', () => {
    for (const mod of ADMIN_MODULES) {
      expect(mod.subtitle.length).toBeLessThanOrEqual(45);
      expect(mod).not.toHaveProperty('description');
      expect(mod).not.toHaveProperty('featureOverview');
    }
  });

  it('puts Overview first and Other last', () => {
    expect(ADMIN_MODULES[0].id).toBe('overview');
    expect(ADMIN_MODULES.at(-1)?.id).toBe('other');
  });
});
