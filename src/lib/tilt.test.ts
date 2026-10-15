import { describe, it, expect } from 'vitest';
import { tiltFor, tiltTransform } from './tilt';

describe('tiltFor', () => {
  it('is level when the pointer is in the middle', () => {
    const t = tiltFor(110, 75, 220, 150);
    expect(t.rotateX).toBeCloseTo(0, 10);
    expect(t.rotateY).toBeCloseTo(0, 10);
    expect(t.translateX).toBeCloseTo(0, 10);
    expect(t.translateY).toBeCloseTo(0, 10);
  });

  it('leans up to five degrees towards each edge', () => {
    expect(tiltFor(0, 75, 220, 150).rotateY).toBeCloseTo(5, 10); // pointer at the left edge
    expect(tiltFor(220, 75, 220, 150).rotateY).toBeCloseTo(-5, 10); // right edge
    expect(tiltFor(110, 0, 220, 150).rotateX).toBeCloseTo(-5, 10); // top edge
    expect(tiltFor(110, 150, 220, 150).rotateX).toBeCloseTo(5, 10); // bottom edge
  });

  it('shifts the card a few pixels the same way', () => {
    expect(tiltFor(0, 75, 220, 150).translateX).toBeCloseTo(-5, 10);
    expect(tiltFor(220, 75, 220, 150).translateX).toBeCloseTo(5, 10);
  });

  it('keeps the same angles whatever the card size, and gives the container 2.5 times the longest side', () => {
    expect(tiltFor(0, 0, 400, 200).rotateY).toBeCloseTo(tiltFor(0, 0, 100, 50).rotateY, 10);
    expect(tiltFor(10, 10, 220, 150).perspective).toBe(550);
    expect(tiltFor(10, 10, 150, 220).perspective).toBe(550);
  });

  it('puts the reflection near the pointer, sized to 1.5 times the longest side', () => {
    const t = tiltFor(100, 50, 220, 150);
    expect(t.reflection.size).toBe(330);
    expect(t.reflection.x).toBeCloseTo(220 * 0.1 + 100 * 0.8, 10);
    expect(t.reflection.y).toBeCloseTo(50 - 75, 10);
  });

  it('survives a card with no size yet', () => {
    const t = tiltFor(5, 5, 0, 0);
    expect(Object.values(t).every((v) => typeof v === 'object' || Number.isFinite(v as number))).toBe(true);
  });
});

describe('tiltTransform', () => {
  it('lifts by 4rem and applies the tilt, in the order the Apple TV card does', () => {
    const s = tiltTransform(tiltFor(0, 0, 100, 100));
    expect(s).toBe('translateZ(4rem) rotateY(5deg) rotateX(-5deg) translateX(-5px) translateY(-5px)');
  });
});
