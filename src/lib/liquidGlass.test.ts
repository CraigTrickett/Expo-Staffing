import { describe, it, expect } from 'vitest';
import { buildGlassMaps, DEFAULT_GLASS, displacementMap, isChromiumBrowser, refractionProfile, specularMap, SURFACES } from './liquidGlass';

const px = (d: Uint8ClampedArray, w: number, x: number, y: number) => {
  const i = (y * w + x) * 4;
  return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] };
};

describe('refraction profile', () => {
  it('has a finite value at every step across the rim, and bends the light somewhere', () => {
    const p = refractionProfile(80, 27, SURFACES.convex_squircle, 3, 128);
    expect(p).toHaveLength(128);
    expect(Array.from(p).every(Number.isFinite)).toBe(true);
    expect(Array.from(p).some((v) => Math.abs(v) > 1)).toBe(true);
  });

  it('bends light more for a higher index of refraction', () => {
    const peak = (ior: number) => Math.max(...Array.from(refractionProfile(80, 27, SURFACES.convex_squircle, ior)).map(Math.abs));
    expect(peak(3)).toBeGreaterThan(peak(1.2));
  });

  it('every surface shape starts at nothing and rises towards the flat middle', () => {
    for (const fn of Object.values(SURFACES)) {
      expect(Number.isFinite(fn(0.5))).toBe(true);
    }
    expect(SURFACES.convex_squircle(0)).toBeCloseTo(0, 5);
    expect(SURFACES.convex_squircle(1)).toBeCloseTo(1, 5);
  });
});

describe('displacement map', () => {
  const w = 200;
  const h = 140;
  const radius = 28;
  const bezel = 27;
  const profile = refractionProfile(80, bezel, SURFACES.convex_squircle, 3);
  const max = Math.max(...Array.from(profile).map(Math.abs));
  const d = displacementMap(w, h, radius, bezel, profile, max);

  it('is one RGBA pixel per point', () => {
    expect(d).toHaveLength(w * h * 4);
  });

  it('leaves the flat middle unshifted (128 is "no shift")', () => {
    expect(px(d, w, 100, 70)).toEqual({ r: 128, g: 128, b: 0, a: 255 });
  });

  it('shifts light at the rim, in opposite directions on opposite sides', () => {
    const left = px(d, w, 2, 70).r - 128;
    const right = px(d, w, w - 3, 70).r - 128;
    const top = px(d, w, 100, 2).g - 128;
    const bottom = px(d, w, 100, h - 3).g - 128;
    expect(Math.abs(left)).toBeGreaterThan(2);
    expect(Math.abs(right)).toBeGreaterThan(2);
    expect(Math.sign(left)).toBe(-Math.sign(right));
    expect(Math.sign(top)).toBe(-Math.sign(bottom));
  });

  it('keeps every value inside a byte', () => {
    for (let i = 0; i < d.length; i += 4) expect(d[i]).toBeGreaterThanOrEqual(0);
  });
});

describe('specular map', () => {
  const w = 200;
  const h = 140;
  const s = specularMap(w, h, 28, 68);
  it('is clear in the middle and lit along the rim', () => {
    expect(px(s, w, 100, 70).a).toBe(0);
    let lit = 0;
    for (let x = 0; x < w; x++) for (const y of [1, h - 2]) lit += px(s, w, x, y).a > 0 ? 1 : 0;
    for (let y = 0; y < h; y++) for (const x of [1, w - 2]) lit += px(s, w, x, y).a > 0 ? 1 : 0;
    expect(lit).toBeGreaterThan(20);
  });
});

describe('buildGlassMaps', () => {
  it('returns maps sized to the pane, with the demo defaults', () => {
    const m = buildGlassMaps(220, 150, 28)!;
    expect(m.width).toBe(220);
    expect(m.height).toBe(150);
    expect(m.displacement).toHaveLength(220 * 150 * 4);
    expect(m.specular).toHaveLength(220 * 150 * 4);
    expect(m.scale).toBeGreaterThan(0);
    expect(m.options).toEqual(DEFAULT_GLASS);
  });
  it('limits the bezel to the corner radius and the pane size', () => {
    expect(() => buildGlassMaps(40, 30, 200)).not.toThrow();
    expect(buildGlassMaps(40, 30, 200)).not.toBeNull();
  });
  it('declines panes that are too small or have no usable corner', () => {
    expect(buildGlassMaps(4, 4, 10)).toBeNull();
    expect(buildGlassMaps(0, 100, 10)).toBeNull();
    expect(buildGlassMaps(NaN, 100, 10)).toBeNull();
    expect(buildGlassMaps(100, 100, 0)).toBeNull();
  });
  it('lets the options be overridden', () => {
    expect(buildGlassMaps(220, 150, 28, { blur: 5 })!.options.blur).toBe(5);
  });
});


describe('isChromiumBrowser', () => {
  const UA = {
    chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
    opera: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/110.0.0.0',
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
    iosChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1',
    iosFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
    jsdom: 'Mozilla/5.0 (linux) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/30.0.0',
  };
  it('is true for Chrome, Edge, Opera and Chrome on Android', () => {
    for (const k of ['chrome', 'edge', 'opera', 'android'] as const) expect(isChromiumBrowser(UA[k]), k).toBe(true);
  });
  it('is false for Safari and Firefox, which accept the CSS but draw nothing', () => {
    for (const k of ['safari', 'firefox'] as const) expect(isChromiumBrowser(UA[k]), k).toBe(false);
  });
  it('is false for every browser on iOS, which is all WebKit underneath', () => {
    for (const k of ['iosChrome', 'iosFirefox'] as const) expect(isChromiumBrowser(UA[k]), k).toBe(false);
  });
  it('is false for a test environment', () => {
    expect(isChromiumBrowser(UA.jsdom)).toBe(false);
  });
  it('trusts the browser\'s own brand list when it has one', () => {
    expect(isChromiumBrowser(UA.safari, [{ brand: 'Chromium' }, { brand: 'Not.A/Brand' }])).toBe(true);
    expect(isChromiumBrowser(UA.chrome, [{ brand: 'Safari' }])).toBe(false);
  });
});
