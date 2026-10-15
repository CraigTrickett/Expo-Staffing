import React, { useId } from 'react';
import type { SessionOrigin } from '@/types/schedule';
import { ORIGIN_STYLE } from './originStyle';

interface OriginPickerProps {
  value: SessionOrigin;
  onChange: (next: SessionOrigin) => void;
  label: string;
}

/** Internal or external. Each option shows its colour and its word, so neither carries the meaning alone. */
export const OriginPicker: React.FC<OriginPickerProps> = ({ value, onChange, label }) => {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex gap-2">
        {(['internal', 'external'] as const).map((o) => {
          const style = ORIGIN_STYLE[o];
          const selected = value === o;
          return (
            <label
              key={o}
              className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold transition-shadow focus-within:ring-2 focus-within:ring-[#0063a3] ${selected ? 'shadow-xs ring-1' : 'opacity-75 hover:opacity-100'}`}
              style={{ background: style.bg, borderColor: selected ? style.text : style.border, color: style.text, ['--tw-ring-color' as string]: style.text }}
            >
              <input type="radio" name={name} value={o} checked={selected} onChange={() => onChange(o)} className="accent-[#0063a3]" />
              {style.label}
              <span className="sr-only">{o === 'internal' ? ' (Trimble\'s own session)' : ' (a customer or partner session)'}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
