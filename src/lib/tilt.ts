/**
 * How a card leans towards the pointer. These are the formulas from marcreichel/apple-tv-card (MIT):
 * a card tilts up to 5 degrees either way, shifts a little, and a soft reflection follows the pointer.
 * Position is measured from the card's own top-left corner, in its own (untilted) pixels.
 */
export interface Tilt {
  /** Degrees about the vertical axis: the left edge lifts when the pointer is on the right. */
  rotateY: number;
  /** Degrees about the horizontal axis. */
  rotateX: number;
  translateX: number;
  translateY: number;
  /** The perspective the card's container needs, in px. */
  perspective: number;
  reflection: { size: number; x: number; y: number };
}

export const TILT_RANGE = 10;
export const LIFT_REM = 4;
export const PERSPECTIVE_FACTOR = 2.5;

export function tiltFor(posX: number, posY: number, width: number, height: number): Tilt {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const base = Math.max(w, h);
  return {
    rotateY: ((w / 2 - posX) / w) * TILT_RANGE,
    rotateX: (((h / 2 - posY) * -1) / h) * TILT_RANGE,
    translateX: (((w / 2 - posX) * -1) / w) * TILT_RANGE,
    translateY: (((h / 2 - posY) * -1) / h) * TILT_RANGE,
    perspective: base * PERSPECTIVE_FACTOR,
    reflection: { size: base * 1.5, x: w * 0.1 + posX * 0.8, y: posY - h / 2 },
  };
}

/** The CSS transform for a card that is lifted and tilted. */
export const tiltTransform = (t: Tilt): string =>
  `translateZ(${LIFT_REM}rem) rotateY(${t.rotateY}deg) rotateX(${t.rotateX}deg) translateX(${t.translateX}px) translateY(${t.translateY}px)`;
