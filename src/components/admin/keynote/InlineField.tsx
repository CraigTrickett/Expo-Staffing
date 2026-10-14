import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from '@/components/common/Toast';
import { cn } from '@/lib/utils';

/**
 * Cells that read as plain text until you reach for them. Hover shows an edge,
 * focus shows the field. Edits commit on blur or Enter; Escape puts the old
 * value back. Escape is swallowed only while there is something to discard, so
 * an untouched field still lets Escape close the modal.
 */
export const inlineFieldClass =
  'block w-full rounded border border-transparent bg-transparent px-2 py-1 text-xs text-[#252a2e] ' +
  'placeholder:text-[#5b6770] hover:border-[#d8dce0] hover:bg-white ' +
  'focus:border-[#0063a3] focus:bg-white focus:outline-none focus:shadow-[0_0_0_3px_rgba(0,99,163,0.18)] ' +
  'transition-[border-color,background-color,box-shadow] duration-150';

interface InlineTextProps {
  value: string;
  onCommit: (next: string) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
  requiredMessage?: string;
  semibold?: boolean;
  className?: string;
}

export const InlineText: React.FC<InlineTextProps> = ({
  value,
  onCommit,
  label,
  placeholder,
  required,
  requiredMessage,
  semibold,
  className = '',
}) => {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const focused = useRef(false);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  // Grow with the text so long notes wrap instead of truncating.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const handleBlur = () => {
    focused.current = false;
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(value);
      return;
    }
    const next = draft.replace(/\s+/g, ' ').trim();
    if (required && !next) {
      setDraft(value);
      toast.error(requiredMessage || `${label} can't be empty.`, 'Not saved');
      return;
    }
    setDraft(next);
    if (next !== value) onCommit(next);
  };

  return (
    <textarea
      ref={ref}
      rows={1}
      value={draft}
      aria-label={label}
      placeholder={placeholder}
      spellCheck
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape' && draft !== value) {
          e.stopPropagation();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      className={cn(inlineFieldClass, 'resize-none overflow-hidden leading-snug', semibold && 'font-semibold', className)}
    />
  );
};

interface InlineNumberProps {
  value: number;
  min: number;
  max: number;
  label: string;
  /** Fires on every valid keystroke so dependent views (timeline, start times) follow along. */
  onLive?: (next: number) => void;
  /** Fires once on blur or Enter if the value moved. */
  onCommit: (next: number) => void;
  className?: string;
}

export const InlineNumber: React.FC<InlineNumberProps> = ({
  value,
  min,
  max,
  label,
  onLive,
  onCommit,
  className = '',
}) => {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  const startValue = useRef(value);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  const handleBlur = () => {
    focused.current = false;
    if (cancelled.current) {
      cancelled.current = false;
      setDraft(String(startValue.current));
      onLive?.(startValue.current);
      return;
    }
    const parsed = parseInt(draft, 10);
    const next = Number.isNaN(parsed) ? startValue.current : clamp(parsed);
    setDraft(String(next));
    onLive?.(next);
    if (next !== startValue.current) onCommit(next);
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      aria-label={label}
      onFocus={(e) => {
        focused.current = true;
        startValue.current = value;
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = parseInt(e.target.value, 10);
        if (!Number.isNaN(parsed)) onLive?.(clamp(parsed));
      }}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === 'Escape' && String(startValue.current) !== draft) {
          e.stopPropagation();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      className={cn(
        inlineFieldClass,
        'w-14 text-right font-mono tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className
      )}
    />
  );
};
