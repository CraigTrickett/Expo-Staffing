import React, { useId } from 'react';
import { ChevronRight } from 'lucide-react';

interface StageSectionProps {
  title: string;
  description?: string;
  /** One line shown while collapsed, so a closed stage still reports where it stands. */
  summary: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  isCurrent?: boolean;
  /** Advance button and similar. Lives beside the toggle, never inside it. */
  action?: React.ReactNode;
  titleClassName?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A production stage that folds away. The body animates with grid-template-rows
 * (0fr to 1fr), which handles content of any height without measuring, and is
 * marked inert while closed so folded controls can't take focus.
 */
export const StageSection: React.FC<StageSectionProps> = ({
  title,
  description,
  summary,
  open,
  onToggle,
  isCurrent,
  action,
  titleClassName = 'text-[#0063a3]',
  icon,
  children,
}) => {
  const uid = useId();
  const headingId = `${uid}-heading`;
  const bodyId = `${uid}-body`;

  return (
    <section className="rounded border border-[#d8dce0] bg-white shadow-2xs" aria-labelledby={headingId}>
      <div className="flex items-center gap-3 p-3 sm:px-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="focus-ring group -m-1 flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded p-1 text-left"
        >
          <ChevronRight
            aria-hidden="true"
            className={`mt-0.5 h-4 w-4 shrink-0 text-[#5b6770] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:text-[#0063a3] motion-reduce:transition-none ${
              open ? 'rotate-90' : ''
            }`}
          />
          <span className="min-w-0">
            <span
              id={headingId}
              className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${titleClassName}`}
            >
              {icon}
              <span>{title}</span>
              {isCurrent && (
                <span className="rounded border border-[#b9dcf0] bg-[#e5f2f8] px-1.5 py-px text-[10px] font-bold normal-case tracking-normal text-[#004f83]">
                  Current stage
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-[#46535e]">
              {open ? description : summary}
            </span>
          </span>
        </button>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      <div
        id={bodyId}
        role="region"
        aria-labelledby={headingId}
        inert={!open}
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 border-t border-[#e7eaef] bg-[#f8f9fa] p-3 sm:p-4">{children}</div>
        </div>
      </div>
    </section>
  );
};
