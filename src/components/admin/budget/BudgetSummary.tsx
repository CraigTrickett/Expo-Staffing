import React from 'react';
import type { BudgetData } from '@/types/budget';
import { budgetTotals, formatMoney } from '@/lib/budget';
import { TOTAL_STYLE } from './levelStyle';

const Stat: React.FC<{ label: string; value: string; note?: string; tone?: string }> = ({ label, value, note, tone }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold text-[#5b6770]">{label}</dt>
    <dd className="mt-0.5 truncate font-mono text-lg font-bold tabular-nums" style={{ color: tone || '#252a2e' }}>
      {value}
    </dd>
    {note && <dd className="text-[11px] text-[#5b6770]">{note}</dd>}
  </div>
);

export const BudgetSummary: React.FC<{ data: BudgetData }> = ({ data }) => {
  const totals = budgetTotals(data);
  const style = TOTAL_STYLE[totals.level];
  const money = (n: number) => formatMoney(n, data.currency);
  const pct = totals.percentUsed;

  // The track always shows 100% of the approved budget. If the forecast runs past it,
  // the track stretches so the overshoot is visible rather than clipped.
  const scale = pct === null ? 1 : Math.max(1, pct);
  const fill = pct === null ? 0 : (Math.min(pct, scale) / scale) * 100;
  const marker = (1 / scale) * 100;
  const over = totals.headroom !== null && totals.headroom < 0;

  return (
    <section aria-label="Budget summary" className="rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        <Stat label="Approved" value={totals.approved === null ? 'Not set' : money(totals.approved)} />
        <Stat label="Forecast" value={money(totals.forecast)} note="Latest figure per line" />
        <Stat label="Committed" value={money(totals.committed)} note="Quoted, ordered or invoiced" />
        <Stat label="Actual" value={money(totals.actual)} note="Invoiced or paid" />
        <Stat
          label={over ? 'Over by' : 'Headroom'}
          value={totals.headroom === null ? '\u2013' : money(Math.abs(totals.headroom))}
          tone={totals.headroom === null ? undefined : style.text}
          
        />
      </dl>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <p className="text-[#46535e]">
            {pct === null ? (
              'Confirm a budget to compare the forecast against it.'
            ) : (
              <>
                <span className="font-mono font-semibold tabular-nums text-[#252a2e]">{Math.round(pct * 100)}%</span> of the
                approved budget is forecast
              </>
            )}
          </p>
          <span
            className="rounded border px-2 py-0.5 font-semibold"
            style={{ color: style.text, background: style.bg, borderColor: style.border }}
          >
            {style.label}
          </span>
        </div>

        <div
          role="progressbar"
          aria-label="Forecast as a share of the approved budget"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct === null ? 0 : Math.min(100, Math.round(pct * 100))}
          aria-valuetext={pct === null ? 'No approved budget' : `${Math.round(pct * 100)} percent of the approved budget`}
          className="relative mt-2 h-2.5 rounded-full bg-[#e7eaef]"
        >
          <div
            className="h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            style={{ width: `${fill}%`, background: style.bar }}
          />
          {pct !== null && (
            <div
              className="absolute -bottom-1 -top-1 w-0.5 bg-[#252a2e]"
              style={{ left: `calc(${marker}% - 1px)` }}
              aria-hidden="true"
              title="100% of approved budget"
            />
          )}
        </div>
      </div>
    </section>
  );
};
