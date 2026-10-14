import { describe, it, expect, beforeEach } from 'vitest';
import { ADMIN_MODULES, getMruModuleIds, recordModuleUsage } from './adminModules';

describe('ADMIN_MODULES', () => {
  it('contains all requested module cards', () => {
    const titles = ADMIN_MODULES.map((m) => m.title);

    // Required user modules
    expect(titles).toContain('Expo Booths');
    expect(titles).toContain('Key Stakeholders');
    expect(titles).toContain('Dead lines');
    expect(titles).toContain('Sponsorship');
    expect(titles).toContain('Swag');
    expect(titles).toContain('Keynote / General Session');
    expect(titles).toContain('Session Scheduling');
    expect(titles).toContain('Resources');
    expect(titles).toContain('Social Event');
    expect(titles).toContain('Budget');
    expect(titles).toContain('Marketing');

    // Valuable suggested modules
    expect(titles).toContain('Badging & Registration');
    expect(titles).toContain('Catering & Hospitality');
    expect(titles).not.toContain('Vendor & Freight Logistics');
    expect(titles).not.toContain('Security & Emergency');
  });

  it('has valid categories and featureOverviews for all modules', () => {
    for (const mod of ADMIN_MODULES) {
      expect(mod.id).toBeTruthy();
      expect(mod.title).toBeTruthy();
      expect(mod.description).toBeTruthy();
      expect(mod.featureOverview.headline).toBeTruthy();
      expect(mod.featureOverview.keyCapabilities.length).toBeGreaterThan(0);
    }
  });

  describe('MRU Tracking', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      const fakeLocalStorage = {
        getItem: (key: string) => mockStorage[key] || null,
        setItem: (key: string, val: string) => {
          mockStorage[key] = val;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
      };

      (globalThis as unknown as { localStorage: typeof fakeLocalStorage }).localStorage = fakeLocalStorage;
      (globalThis as unknown as { window: { localStorage: typeof fakeLocalStorage } }).window = {
        localStorage: fakeLocalStorage,
      };
    });

    it('records and returns most recently used modules in order', () => {
      expect(getMruModuleIds()).toEqual([]);

      recordModuleUsage('swag');
      expect(getMruModuleIds()).toEqual(['swag']);

      recordModuleUsage('sponsorship');
      expect(getMruModuleIds()).toEqual(['sponsorship', 'swag']);

      // Re-clicking 'swag' brings it back to the front
      recordModuleUsage('swag');
      expect(getMruModuleIds()).toEqual(['swag', 'sponsorship']);
    });
  });
});
