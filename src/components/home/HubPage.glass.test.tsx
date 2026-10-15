// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

vi.mock('@/lib/firebase', async (orig) => (await import('@/test/harness')).firebaseMock(await orig()));

import App from '@/App';
import { fb, makeEvent, resetDom } from '@/test/harness';

beforeEach(() => {
  resetDom();
  fb.events = [makeEvent('a', 'Alpha Summit')];
});
afterEach(() => {
  setUserAgent('Mozilla/5.0 (linux) AppleWebKit/537.36 (KHTML, like Gecko) jsdom/30.0.0');
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const openMenu = async () => {
  window.location.hash = '#/hub/a';
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: 'Alpha Summit' });
};

const UA = {
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};
const setUserAgent = (ua: string) => Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
const acceptsUrlBackdrop = () => vi.stubGlobal('CSS', { supports: (prop: string, value: string) => prop === 'backdrop-filter' && value.includes('url(') });

/** A browser that can run an SVG filter on the backdrop, and draw to a canvas. */
const chromium = () => {
  setUserAgent(UA.chrome);
  acceptsUrlBackdrop();
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 220 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 168 });
  vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ putImageData() {} } as never);
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA');
};

describe('the glass on the menu cards', () => {
  it('is frosted where the browser cannot refract (and builds no filter)', async () => {
    await openMenu();
    expect(document.querySelector('[data-glass="blur"]')).toBeTruthy();
    expect(document.querySelector('[data-glass="svg"]')).toBeNull();
    expect(document.querySelector('filter#showrunner-glass')).toBeNull();
    expect(document.querySelectorAll('.glass-card').length).toBeGreaterThan(10);
  });

  it('builds the refraction filter, sized to the cards, where the browser can', async () => {
    chromium();
    await openMenu();
    await waitFor(() => expect(document.querySelector('[data-glass="svg"]')).toBeTruthy());
    const filter = document.querySelector('filter#showrunner-glass')!;
    expect(filter).toBeTruthy();
    const displace = filter.querySelector('feDisplacementMap')!;
    expect(displace.getAttribute('xChannelSelector')).toBe('R');
    expect(displace.getAttribute('yChannelSelector')).toBe('G');
    expect(Number(displace.getAttribute('scale'))).toBeGreaterThan(0);
    const images = Array.from(filter.querySelectorAll('feImage'));
    expect(images).toHaveLength(2);
    for (const img of images) {
      expect(img.getAttribute('href')).toMatch(/^data:image\/png/);
      expect(img.getAttribute('width')).toBe('220');
      expect(img.getAttribute('height')).toBe('168');
    }
    expect(filter.querySelector('feGaussianBlur')).toBeTruthy();
    expect(document.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });

  it('stays frosted in Firefox and Safari, which accept the CSS but draw nothing: they would otherwise get a clear, flat card', async () => {
    for (const ua of [UA.firefox, UA.safari]) {
      chromium();
      setUserAgent(ua); // the CSS engine says yes, as it does in those browsers
      await openMenu();
      await new Promise((r) => setTimeout(r, 50));
      expect(document.querySelector('[data-glass="svg"]'), ua).toBeNull();
      expect(document.querySelector('[data-glass="blur"]'), ua).toBeTruthy();
      expect(document.querySelector('filter#showrunner-glass'), ua).toBeNull();
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('stays frosted if the canvas cannot be used', async () => {
    chromium();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await openMenu();
    await new Promise((r) => setTimeout(r, 100));
    expect(document.querySelector('[data-glass="svg"]')).toBeNull();
    expect(document.querySelector('[data-glass="blur"]')).toBeTruthy();
  });

  it('lists a card for every area plus User Manager, none of them draggable', async () => {
    await openMenu();
    const cards = Array.from(document.querySelectorAll<HTMLAnchorElement>('a.glass-card'));
    expect(cards.length).toBe(16);
    expect(cards.every((c) => c.getAttribute('draggable') === 'false')).toBe(true);
  });
});
