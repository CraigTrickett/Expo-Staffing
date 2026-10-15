/**
 * The maths behind a "liquid glass" surface: a pane whose edge bends the light, so what is behind it
 * appears to curve around the rim. It follows the technique in archisvaze/liquid-glass (MIT licence,
 * (c) 2026 Archis Vaze): work out how much a ray bends where it enters a curved bezel (Snell's law),
 * paint that as a displacement map, and let an SVG filter shift the backdrop by it.
 *
 * Everything here is plain arithmetic on pixel arrays, so it can be tested without a browser.
 */

export type SurfaceFn = (x: number) => number;

/** How the glass thickens from its outer edge (0) to the flat middle (1). */
export const SURFACES: Record<'convex_squircle' | 'convex_circle' | 'concave' | 'lip', SurfaceFn> = {
  convex_squircle: (x) => Math.pow(1 - Math.pow(1 - x, 4), 0.25),
  convex_circle: (x) => Math.sqrt(1 - (1 - x) * (1 - x)),
  concave: (x) => 1 - Math.sqrt(1 - (1 - x) * (1 - x)),
  lip: (x) => {
    const convex = Math.pow(1 - Math.pow(1 - Math.min(x * 2, 1), 4), 0.25);
    const concave = 1 - Math.sqrt(1 - (1 - x) * (1 - x)) + 0.1;
    const t = 6 * x ** 5 - 15 * x ** 4 + 10 * x ** 3;
    return convex * (1 - t) + concave * t;
  },
};

export interface GlassOptions {
  /** How thick the glass is, in px. */
  thickness: number;
  /** Width of the curved rim, in px. Limited by the corner radius. */
  bezel: number;
  /** Index of refraction. Higher bends the light more. */
  ior: number;
  /** Scales the displacement the filter applies. */
  scaleRatio: number;
  /** Blur applied to what is behind the glass, in px. Keeps text on top readable. */
  blur: number;
  specularOpacity: number;
  specularSaturation: number;
}

/**
 * Tuned by simulating the filter over the real backdrop, rather than copied from the demo. The demo is
 * photographed over a detailed photo with a nearly clear pane. Here the pane carries text, so it is
 * lighter on the bend and a little softer: the bend is still plain at the rim, and text over it keeps
 * a contrast of at least 5.8:1 at its worst.
 */
export const DEFAULT_GLASS: GlassOptions = {
  thickness: 100,
  bezel: 60,
  ior: 3,
  scaleRatio: 0.6,
  blur: 2.5,
  specularOpacity: 0.55,
  specularSaturation: 2,
};

/** How far a ray is shifted at each step across the rim, from the outside in. */
export function refractionProfile(glassThickness: number, bezelWidth: number, heightFn: SurfaceFn, ior: number, samples = 128): Float64Array {
  const eta = 1 / ior;
  const refract = (nx: number, ny: number): [number, number] | null => {
    const dot = ny;
    const k = 1 - eta * eta * (1 - dot * dot);
    if (k < 0) return null;
    const sq = Math.sqrt(k);
    return [-(eta * dot + sq) * nx, eta - (eta * dot + sq) * ny];
  };
  const profile = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = i / samples;
    const y = heightFn(x);
    const dx = x < 1 ? 0.0001 : -0.0001;
    const deriv = (heightFn(x + dx) - y) / dx;
    const mag = Math.sqrt(deriv * deriv + 1);
    const ref = refract(-deriv / mag, -1 / mag);
    profile[i] = ref ? ref[0] * ((y * bezelWidth + glassThickness) / ref[1]) : 0;
  }
  return profile;
}

interface Geometry {
  r: number;
  rSq: number;
  r1Sq: number;
  rBSq: number;
  wB: number;
  hB: number;
}

const geometry = (w: number, h: number, radius: number, bezelWidth: number): Geometry => ({
  r: radius,
  rSq: radius * radius,
  r1Sq: (radius + 1) ** 2,
  rBSq: Math.max(radius - bezelWidth, 0) ** 2,
  wB: w - radius * 2,
  hB: h - radius * 2,
});

/** The red and green channels hold the sideways and up-down shift at each pixel (128 means none). */
export function displacementMap(w: number, h: number, radius: number, bezelWidth: number, profile: Float64Array, maxDisp: number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 128;
    d[i + 1] = 128;
    d[i + 2] = 0;
    d[i + 3] = 255;
  }
  const { r, rSq, r1Sq, rBSq, wB, hB } = geometry(w, h, radius, bezelWidth);
  const S = profile.length;
  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;
      const cos = x / dist;
      const sin = y / dist;
      const bi = Math.min(((fromSide / bezelWidth) * S) | 0, S - 1);
      const disp = profile[bi] || 0;
      const dX = (-cos * disp) / maxDisp;
      const dY = (-sin * disp) / maxDisp;
      const idx = (y1 * w + x1) * 4;
      d[idx] = (128 + dX * 127 * op + 0.5) | 0;
      d[idx + 1] = (128 + dY * 127 * op + 0.5) | 0;
    }
  }
  return d;
}

/** A soft white highlight along the rim that faces the light. */
export function specularMap(w: number, h: number, radius: number, bezelWidth: number, angle = Math.PI / 3): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  const { r, rSq, r1Sq, rBSq, wB, hB } = geometry(w, h, radius, bezelWidth);
  const sv = [Math.cos(angle), Math.sin(angle)];
  for (let y1 = 0; y1 < h; y1++) {
    for (let x1 = 0; x1 < w; x1++) {
      const x = x1 < r ? x1 - r : x1 >= w - r ? x1 - r - wB : 0;
      const y = y1 < r ? y1 - r : y1 >= h - r ? y1 - r - hB : 0;
      const dSq = x * x + y * y;
      if (dSq > r1Sq || dSq < rBSq) continue;
      const dist = Math.sqrt(dSq);
      const fromSide = r - dist;
      const op = dSq < rSq ? 1 : 1 - (dist - Math.sqrt(rSq)) / (Math.sqrt(r1Sq) - Math.sqrt(rSq));
      if (op <= 0 || dist === 0) continue;
      const cos = x / dist;
      const sin = -y / dist;
      const dot = Math.abs(cos * sv[0] + sin * sv[1]);
      const edge = Math.sqrt(Math.max(0, 1 - (1 - fromSide) ** 2));
      const coeff = dot * edge;
      const col = (255 * coeff) | 0;
      const alpha = (col * coeff * op) | 0;
      const idx = (y1 * w + x1) * 4;
      d[idx] = col;
      d[idx + 1] = col;
      d[idx + 2] = col;
      d[idx + 3] = alpha;
    }
  }
  return d;
}

export interface GlassMaps {
  width: number;
  height: number;
  /** The displacement the filter should apply. */
  scale: number;
  displacement: Uint8ClampedArray;
  specular: Uint8ClampedArray;
  options: GlassOptions;
}

/** Everything the SVG filter needs for a pane of this size, or null if it is too small to bother with. */
export function buildGlassMaps(width: number, height: number, cornerRadius: number, options: Partial<GlassOptions> = {}): GlassMaps | null {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!(w >= 8 && h >= 8)) return null;
  const opts = { ...DEFAULT_GLASS, ...options };
  const radius = Math.floor(Math.min(cornerRadius, w / 2, h / 2));
  if (radius < 2) return null;
  const bezel = Math.max(1, Math.min(opts.bezel, radius - 1, Math.min(w, h) / 2 - 1));
  const profile = refractionProfile(opts.thickness, bezel, SURFACES.convex_squircle, opts.ior, 128);
  let maxDisp = 0;
  for (const v of profile) maxDisp = Math.max(maxDisp, Math.abs(v));
  maxDisp = maxDisp || 1;
  return {
    width: w,
    height: h,
    scale: maxDisp * opts.scaleRatio,
    displacement: displacementMap(w, h, radius, bezel, profile, maxDisp),
    specular: specularMap(w, h, radius, bezel * 2.5),
    options: opts,
  };
}

/** Draws pixels onto a canvas and returns them as an image address, or null where there is no canvas. */
export function pixelsToDataUrl(data: Uint8ClampedArray, w: number, h: number): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
    return canvas.toDataURL();
  } catch {
    return null;
  }
}

/**
 * Whether a browser is Chromium-based (Chrome, Edge, Brave, Opera, Arc). On iOS every browser, Chrome
 * included, is WebKit underneath, so it is not Chromium there whatever it calls itself.
 */
export function isChromiumBrowser(userAgent: string, brands?: { brand: string }[]): boolean {
  if (/\b(CriOS|FxiOS|EdgiOS|OPiOS)\//.test(userAgent)) return false;
  if (brands && brands.length > 0) return brands.some((b) => /Chromium/i.test(b.brand));
  return /\bChrome\/\d/.test(userAgent) && !/\bFirefox\//.test(userAgent);
}

/**
 * True where the browser really applies an SVG filter to what is behind an element. Only Chromium does.
 * Firefox and Safari accept the CSS declaration without drawing anything, so asking the CSS engine
 * whether it parses is not enough: those browsers would be told "yes", lose their frosted fallback,
 * and show a clear, flat card. This needs both: the declaration parses, and the browser is Chromium.
 */
export function supportsSvgBackdropFilter(): boolean {
  try {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function' || !CSS.supports('backdrop-filter', 'url(#a)')) return false;
    if (typeof navigator === 'undefined') return false;
    const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
    return isChromiumBrowser(navigator.userAgent || '', brands);
  } catch {
    return false;
  }
}
