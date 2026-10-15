import React, { useEffect, useRef } from 'react';
import { tiltFor, tiltTransform } from '@/lib/tilt';

interface TiltGlassCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  /** A short plain label, such as "Not built yet". */
  tag?: string;
}

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A menu card: glass that leans towards the pointer with a moving reflection and layers that shift
 * at different rates. Only a mouse or pen tilts it. A finger just taps, so scrolling is never held
 * up, and keyboard focus lifts the card without tilting it. With reduced motion it does not move.
 */
export const TiltGlassCard: React.FC<TiltGlassCardProps> = ({ href, icon: Icon, title, subtitle, tag }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const frame = useRef(0);
  const scheduled = useRef(false);
  const point = useRef<{ x: number; y: number } | null>(null);

  const reset = () => {
    cancelAnimationFrame(frame.current);
    scheduled.current = false;
    point.current = null;
    const card = cardRef.current;
    if (!card) return;
    card.classList.remove('is-active');
    card.style.transform = '';
    for (const v of ['--tx', '--ty', '--rs', '--rx', '--ry']) card.style.removeProperty(v);
  };

  const paint = () => {
    scheduled.current = false;
    const card = cardRef.current;
    const container = containerRef.current;
    const p = point.current;
    if (!card || !container || !p) return;
    const t = tiltFor(p.x, p.y, card.offsetWidth, card.offsetHeight);
    container.style.perspective = `${t.perspective}px`;
    card.style.transform = tiltTransform(t);
    card.style.setProperty('--tx', String(t.translateX));
    card.style.setProperty('--ty', String(t.translateY));
    card.style.setProperty('--rs', String(t.reflection.size));
    card.style.setProperty('--rx', String(t.reflection.x));
    card.style.setProperty('--ry', String(t.reflection.y));
  };

  const onPointer = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType === 'touch') return;
    const card = cardRef.current;
    if (!card) return;
    card.classList.add('is-active');
    if (prefersReducedMotion()) return;
    // offsetX/Y are in the card's own, untilted pixels, so the tilt does not feed back into the reading.
    const native = e.nativeEvent as PointerEvent;
    const rect = card.getBoundingClientRect();
    point.current = { x: native.offsetX ?? e.clientX - rect.left, y: native.offsetY ?? e.clientY - rect.top };
    if (!scheduled.current) {
      scheduled.current = true;
      frame.current = requestAnimationFrame(paint);
    }
  };

  useEffect(() => reset, []);

  return (
    <div ref={containerRef} className="tilt-container">
      <a ref={cardRef} href={href} draggable={false} className="glass-card group" onPointerEnter={onPointer} onPointerMove={onPointer} onPointerLeave={reset} onPointerCancel={reset} onBlur={reset}>
        <span className="glass-card__reflection" aria-hidden="true" />
        <span className="glass-card__mark glass-card__layer" style={{ ['--k' as string]: 0.2, ['--s' as string]: 1.075 }} aria-hidden="true">
          <Icon className="h-28 w-28" strokeWidth={1.25} />
        </span>
        <div className="glass-card__layer pointer-events-none flex items-start justify-between gap-2" style={{ ['--k' as string]: -1.3 }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0063a3] text-white shadow-xs">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          {tag && <span className="rounded-full border border-white/70 bg-white/60 px-2 py-0.5 text-[10px] font-semibold text-[#3a4a58]">{tag}</span>}
        </div>
        <div className="glass-card__layer pointer-events-none" style={{ ['--k' as string]: -0.65 }}>
          <h2 className="line-clamp-2 text-sm font-bold leading-tight text-[#14284b]">{title}</h2>
          <p className="mt-1 line-clamp-2 text-xs leading-snug text-[#2b3946]">{subtitle}</p>
        </div>
      </a>
    </div>
  );
};

