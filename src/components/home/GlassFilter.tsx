import React, { useEffect, useState } from 'react';
import { buildGlassMaps, pixelsToDataUrl, supportsSvgBackdropFilter } from '@/lib/liquidGlass';
import type { GlassMaps } from '@/lib/liquidGlass';

export const GLASS_FILTER_ID = 'showrunner-glass';

interface Ready {
  maps: GlassMaps;
  displacementUrl: string;
  specularUrl: string;
}

/**
 * Builds the refraction filter for the cards, sized to a sample card, and rebuilds it if that card is
 * resized. Returns whether the glass is ready. Where the browser cannot apply an SVG filter to the
 * backdrop, nothing is built and the cards stay frosted instead.
 */
export function useGlassFilter(sample: () => HTMLElement | null, cornerRadius: number, rebuildWhen?: unknown) {
  const [ready, setReady] = useState<Ready | null>(null);

  useEffect(() => {
    if (!supportsSvgBackdropFilter()) return;
    const el = sample();
    if (!el) return;

    let frame = 0;
    let last = '';
    const rebuild = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const key = `${w}x${h}`;
      if (key === last) return;
      last = key;
      const maps = buildGlassMaps(w, h, cornerRadius);
      if (!maps) return setReady(null);
      const displacementUrl = pixelsToDataUrl(maps.displacement, maps.width, maps.height);
      const specularUrl = pixelsToDataUrl(maps.specular, maps.width, maps.height);
      setReady(displacementUrl && specularUrl ? { maps, displacementUrl, specularUrl } : null);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(rebuild);
    };

    rebuild();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [sample, cornerRadius, rebuildWhen]);

  return ready;
}

/** The hidden SVG that holds the glass filter. Rendered once; every card refers to it by id. */
export const GlassFilter: React.FC<{ glass: Ready | null }> = ({ glass }) => {
  if (!glass) return null;
  const { maps, displacementUrl, specularUrl } = glass;
  const { width, height, scale, options } = maps;
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" colorInterpolationFilters="sRGB" style={{ position: 'absolute', overflow: 'hidden' }}>
      <defs>
        <filter id={GLASS_FILTER_ID} x="0%" y="0%" width="100%" height="100%">
          <feGaussianBlur in="SourceGraphic" stdDeviation={options.blur} result="blurred_source" />
          <feImage href={displacementUrl} x="0" y="0" width={width} height={height} result="disp_map" />
          <feDisplacementMap in="blurred_source" in2="disp_map" scale={scale} xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feColorMatrix in="displaced" type="saturate" values={String(options.specularSaturation)} result="displaced_sat" />
          <feImage href={specularUrl} x="0" y="0" width={width} height={height} result="spec_layer" />
          <feComposite in="displaced_sat" in2="spec_layer" operator="in" result="spec_masked" />
          <feComponentTransfer in="spec_layer" result="spec_faded">
            <feFuncA type="linear" slope={options.specularOpacity} />
          </feComponentTransfer>
          <feBlend in="spec_masked" in2="displaced" mode="normal" result="with_sat" />
          <feBlend in="spec_faded" in2="with_sat" mode="normal" />
        </filter>
      </defs>
    </svg>
  );
};
