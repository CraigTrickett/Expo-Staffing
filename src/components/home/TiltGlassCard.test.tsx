// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { Calendar } from 'lucide-react';
import { TiltGlassCard } from './TiltGlassCard';

const SIZE = { w: 220, h: 168 };

beforeEach(() => {
  // jsdom has no layout, so give every element a size.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => SIZE.w });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => SIZE.h });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as never;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const setup = (props: Partial<React.ComponentProps<typeof TiltGlassCard>> = {}) => {
  render(<TiltGlassCard href="#/hub/a/budget" icon={Calendar} title="Budget" subtitle="Approved budget and cost" {...props} />);
  const link = screen.getByRole('link', { name: /Budget/ });
  const container = link.parentElement as HTMLElement;
  return { link, container };
};
/** A pointer move at a position inside the card (offsetX/Y are in the card's own pixels). */
const move = (el: HTMLElement, x: number, y: number, pointerType = 'mouse', type: 'pointerEnter' | 'pointerMove' = 'pointerMove') => {
  const ev = new Event(type === 'pointerEnter' ? 'pointerover' : 'pointermove', { bubbles: true }) as Event & Record<string, unknown>;
  Object.assign(ev, { pointerType, offsetX: x, offsetY: y, clientX: x, clientY: y });
  if (type === 'pointerEnter') {
    fireEvent.pointerEnter(el, { pointerType });
    fireEvent(el, Object.assign(new Event('pointermove', { bubbles: true }), { pointerType, offsetX: x, offsetY: y }));
  } else fireEvent(el, ev);
};

describe('a menu card', () => {
  it('is a link to its page with the title and one line, and is not draggable', () => {
    const { link } = setup();
    expect(link.getAttribute('href')).toBe('#/hub/a/budget');
    expect(screen.getByRole('heading', { level: 2, name: 'Budget' })).toBeTruthy();
    expect(screen.getByText('Approved budget and cost')).toBeTruthy();
    expect(link.getAttribute('draggable')).toBe('false');
  });

  it('shows a plain tag only when given one', () => {
    setup({ tag: 'Not built yet' });
    expect(screen.getByText('Not built yet')).toBeTruthy();
    cleanup();
    setup();
    expect(screen.queryByText('Not built yet')).toBeNull();
  });

  it('is level until the pointer arrives', () => {
    const { link } = setup();
    expect(link.style.transform).toBe('');
    expect(link.classList.contains('is-active')).toBe(false);
  });

  it('leans towards a mouse pointer: lifted 4rem, tilted, with the layers and reflection set', () => {
    const { link, container } = setup();
    move(link, 0, SIZE.h / 2); // the left edge, halfway down
    expect(link.classList.contains('is-active')).toBe(true);
    expect(link.style.transform).toContain('translateZ(4rem)');
    expect(link.style.transform).toContain('rotateY(5deg)');
    expect(link.style.getPropertyValue('--tx')).toBe('-5');
    expect(link.style.getPropertyValue('--rs')).toBe(String(220 * 1.5));
    expect(container.style.perspective).toBe(`${220 * 2.5}px`);
  });

  it('tilts the other way on the other side', () => {
    const { link } = setup();
    move(link, SIZE.w, SIZE.h / 2);
    expect(link.style.transform).toContain('rotateY(-5deg)');
  });

  it('follows the pointer as it moves', () => {
    const { link } = setup();
    move(link, 0, 84);
    move(link, SIZE.w, 84);
    expect(link.style.transform).toContain('rotateY(-5deg)');
  });

  it('settles back when the pointer leaves', () => {
    const { link } = setup();
    move(link, 10, 10);
    fireEvent.pointerLeave(link);
    expect(link.style.transform).toBe('');
    expect(link.classList.contains('is-active')).toBe(false);
    expect(link.style.getPropertyValue('--tx')).toBe('');
  });

  it('ignores a finger, so scrolling and tapping are never held up', () => {
    const { link } = setup();
    move(link, 10, 10, 'touch');
    expect(link.style.transform).toBe('');
    expect(link.classList.contains('is-active')).toBe(false);
  });

  it('does not move at all with reduced motion, but still lifts its shadow', () => {
    window.matchMedia = ((q: string) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false })) as never;
    const { link } = setup();
    move(link, 10, 10);
    expect(link.style.transform).toBe('');
    expect(link.classList.contains('is-active')).toBe(true);
  });

  it('can be reached and used from the keyboard, with no pointer involved', () => {
    const { link } = setup();
    link.focus();
    expect(document.activeElement).toBe(link);
    expect(link.style.transform).toBe(''); // focus lifts it by CSS, without tilting
    link.blur();
  });

  it('gives each layer its own parallax factor', () => {
    const { link } = setup();
    const factors = Array.from(link.querySelectorAll<HTMLElement>('.glass-card__layer')).map((l) => l.style.getPropertyValue('--k'));
    expect(factors).toEqual(['0.2', '-1.3', '-0.65']);
  });

  it('hides decoration from assistive technology and leaves the name readable', () => {
    const { link } = setup({ tag: 'Not built yet' });
    expect(link.querySelector('.glass-card__reflection')?.getAttribute('aria-hidden')).toBe('true');
    expect(link.querySelector('.glass-card__mark')?.getAttribute('aria-hidden')).toBe('true');
    expect(link.textContent).toContain('Budget');
  });
});
