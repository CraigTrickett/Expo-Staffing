import React, { useId, useMemo, useState } from 'react';
import { History, Plus, ShieldCheck, X } from 'lucide-react';
import type { KeyStakeholder } from '@/types';
import type { BudgetData } from '@/types/budget';
import {
  addApproval,
  addCategory,
  budgetTotals,
  canDeleteCategory,
  categoryRollups,
  formatMoney,
  formatMoneyInput,
  latestApproval,
  parseMoney,
  sumAllocations,
  unallocatedAmount,
  validateApproval,
} from '@/lib/budget';
import type { ApprovalInput } from '@/lib/budget';
import { describeStakeholderRef } from '@/lib/stakeholderRef';
import { formatDate } from '@/lib/utils';
import type { StakeholderRef } from '@/types/stakeholderRef';
import { StakeholderSelect, formFieldClass } from '@/components/common/StakeholderSelect';
import { toast } from '@/components/common/Toast';
import { CATEGORY_STYLE } from './levelStyle';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface ApprovalPanelProps {
  data: BudgetData;
  stakeholders: KeyStakeholder[];
  onCommit: (next: BudgetData) => void;
  onManageStakeholders?: () => void;
}

export const ApprovalPanel: React.FC<ApprovalPanelProps> = ({ data, stakeholders, onCommit, onManageStakeholders }) => {
  const [formOpen, setFormOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const approval = latestApproval(data);
  const totals = budgetTotals(data);
  const rollups = useMemo(() => categoryRollups(data), [data]);
  const money = (n: number) => formatMoney(n, data.currency);
  const shown = rollups.filter((r) => r.approved > 0 || r.lineCount > 0);
  const unallocated = approval ? unallocatedAmount(approval.total, approval.allocations) : 0;

  return (
    <section aria-labelledby="approved-budget-heading" className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="approved-budget-heading" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#252a2e]">
            <ShieldCheck className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />
            Approved Budget
          </h2>
          {approval ? (
            <p className="mt-1 text-xs text-[#46535e]">
              <span className="font-mono text-base font-bold tabular-nums text-[#252a2e]">{money(approval.total)}</span>
              <span className="mx-2 text-[#9aa5ad]" aria-hidden="true">
                |
              </span>
              Version {approval.version}, confirmed {formatDate(approval.confirmedOn)}, authorised by{' '}
              <span className="font-semibold text-[#252a2e]">{describeStakeholderRef(approval.authorisedBy, stakeholders)}</span>
              {approval.reference && <> &middot; Ref {approval.reference}</>}
            </p>
          ) : (
            <p className="mt-1 text-xs text-[#46535e]">
              No approved budget yet.{' '}
              {data.draft ? `A draft of ${money(data.draft.total)} is saved, waiting for authorisation.` : 'Set the figure and record who authorised it.'}
            </p>
          )}
          {approval?.note && <p className="mt-0.5 text-[11px] text-[#5b6770]">{approval.note}</p>}
        </div>

        <div className="flex items-center gap-2">
          {data.approvals.length > 1 && (
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              aria-expanded={historyOpen}
              className="focus-ring flex cursor-pointer items-center gap-1 rounded border border-[#d8dce0] bg-white px-2.5 py-1 text-xs font-semibold text-[#46535e] hover:border-[#0063a3] hover:text-[#0063a3]"
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              History ({data.approvals.length})
            </button>
          )}
          {!formOpen && (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#005084]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {approval ? 'Confirm new budget' : data.draft ? 'Continue draft' : 'Set budget'}
            </button>
          )}
        </div>
      </div>

      {formOpen && (
        <ConfirmBudgetForm
          data={data}
          stakeholders={stakeholders}
          onCommit={onCommit}
          onClose={() => setFormOpen(false)}
          onManageStakeholders={onManageStakeholders}
        />
      )}

      {historyOpen && data.approvals.length > 1 && (
        <div className="overflow-x-auto rounded border border-[#e7eaef]">
          <table className="w-full min-w-[560px] text-left text-xs">
            <caption className="sr-only">Approved budget versions, newest first</caption>
            <thead className="bg-[#f8f9fa] text-[11px] text-[#5b6770]">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-semibold">Version</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Total</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Change</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">Confirmed</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">Authorised by</th>
                <th scope="col" className="px-3 py-1.5 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7eaef]">
              {[...data.approvals]
                .sort((a, b) => b.version - a.version)
                .map((a) => {
                  const prev = data.approvals.find((p) => p.version === a.version - 1);
                  const delta = prev ? a.total - prev.total : null;
                  return (
                    <tr key={a.id}>
                      <td className="px-3 py-1.5 font-mono tabular-nums">v{a.version}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{money(a.total)}</td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-[#46535e]">
                        {delta === null ? '\u2013' : `${delta >= 0 ? '+' : '\u2212'}${money(Math.abs(delta))}`}
                      </td>
                      <td className="px-3 py-1.5">{formatDate(a.confirmedOn)}</td>
                      <td className="px-3 py-1.5">{describeStakeholderRef(a.authorisedBy, stakeholders)}</td>
                      <td className="px-3 py-1.5 text-[#46535e]">{a.reference || '\u2013'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      {approval && shown.length > 0 && (
        <div className="overflow-x-auto rounded border border-[#e7eaef]">
          <table className="w-full min-w-[720px] text-left text-xs">
            <caption className="sr-only">Approved amount against forecast, committed and actual cost, by category</caption>
            <thead className="bg-[#f8f9fa] text-[11px] text-[#5b6770]">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-semibold">Category</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Approved</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Forecast</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Committed</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Actual</th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">Remaining</th>
                <th scope="col" className="w-36 px-3 py-1.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7eaef]">
              {shown.map((r) => {
                const style = CATEGORY_STYLE[r.level];
                return (
                  <tr key={r.category.id}>
                    <th scope="row" className="px-3 py-1.5 font-semibold text-[#252a2e]">{r.category.name}</th>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{money(r.approved)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums">{money(r.forecast)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-[#46535e]">{money(r.committed)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-[#46535e]">{money(r.actual)}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums" style={{ color: r.remaining < 0 ? '#9e1b16' : undefined }}>
                      {r.remaining < 0 ? `\u2212${money(Math.abs(r.remaining))}` : money(r.remaining)}
                    </td>
                    <td className="px-3 py-1.5">
                      {style.label && (
                        <span
                          className="inline-block rounded border px-1.5 py-0.5 text-[11px] font-semibold"
                          style={{ color: style.text, background: style.bg, borderColor: style.border }}
                        >
                          {style.label}
                          {r.percentUsed !== null && ` \u00b7 ${Math.round(r.percentUsed * 100)}%`}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#f8f9fa]">
                <th scope="row" className="px-3 py-1.5 font-semibold text-[#46535e]">Unallocated</th>
                <td className="px-3 py-1.5 text-right font-mono tabular-nums text-[#46535e]">{money(unallocated)}</td>
                <td colSpan={5} className="px-3 py-1.5 text-[11px] text-[#5b6770]">
                  Approved but not assigned to a category.
                </td>
              </tr>
              <tr className="border-t-2 border-[#d8dce0]">
                <th scope="row" className="px-3 py-1.5 font-bold text-[#252a2e]">Total</th>
                <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums">{money(approval.total)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums">{money(totals.forecast)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums">{money(totals.committed)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums">{money(totals.actual)}</td>
                <td className="px-3 py-1.5 text-right font-mono font-bold tabular-nums" style={{ color: (totals.headroom ?? 0) < 0 ? '#9e1b16' : undefined }}>
                  {(totals.headroom ?? 0) < 0 ? `\u2212${money(Math.abs(totals.headroom ?? 0))}` : money(totals.headroom ?? 0)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Confirm form                                                        */
/* ------------------------------------------------------------------ */

const ConfirmBudgetForm: React.FC<{
  data: BudgetData;
  stakeholders: KeyStakeholder[];
  onCommit: (next: BudgetData) => void;
  onClose: () => void;
  onManageStakeholders?: () => void;
}> = ({ data, stakeholders, onCommit, onClose, onManageStakeholders }) => {
  const uid = useId();
  const approval = latestApproval(data);
  const seed = data.draft ?? (approval ? { total: approval.total, allocations: approval.allocations } : undefined);

  const [total, setTotal] = useState(seed ? formatMoneyInput(seed.total) : '');
  const [alloc, setAlloc] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(seed?.allocations ?? {}).map(([id, n]) => [id, formatMoneyInput(n)]))
  );
  const [currency, setCurrency] = useState(data.currency);
  const [confirmedOn, setConfirmedOn] = useState(todayIso());
  const [authorisedBy, setAuthorisedBy] = useState<StakeholderRef | null>(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const totalNum = parseMoney(total) ?? 0;
  const allocations = useMemo(
    () => Object.fromEntries(Object.entries(alloc).map(([id, text]) => [id, parseMoney(text) ?? 0])),
    [alloc]
  );
  const left = unallocatedAmount(totalNum, allocations);
  const currencyLocked = data.approvals.length > 0;
  const money = (n: number) => formatMoney(n, currency);

  const input = (): ApprovalInput => ({
    total: totalNum,
    allocations,
    confirmedOn,
    authorisedBy,
    reference,
    note,
  });

  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateApproval(input(), data.categories);
    setErrors(found);
    if (found.length > 0) return;
    const next = { ...addApproval(data, input()), currency };
    onCommit(next);
    toast.success(`Budget version ${next.approvals.length} confirmed.`);
    onClose();
  };

  const saveDraft = () => {
    if (!(totalNum > 0) && sumAllocations(allocations) === 0) {
      setErrors(['Enter a total or at least one category amount to save a draft.']);
      return;
    }
    onCommit({ ...data, currency, draft: { total: totalNum, allocations } });
    toast.info('Draft saved. It is not authorised until confirmed.');
    onClose();
  };

  const addNewCategory = () => {
    const next = addCategory(data, newCategory);
    if (next === data) {
      toast.error('That category already exists, or the name is empty.', 'Not added');
      return;
    }
    onCommit(next);
    setNewCategory('');
  };

  return (
    <form
      onSubmit={confirm}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      }}
      aria-label="Confirm budget"
      className="space-y-4 rounded border border-[#b9dcf0] bg-[#f8f9fa] p-4 animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#0063a3]">
          {approval ? `Confirm budget version ${approval.version + 1}` : 'Confirm the budget'}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close form"
          className="focus-ring cursor-pointer rounded p-1 text-[#5b6770] hover:bg-[#e5e9ec] hover:text-[#252a2e]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {errors.length > 0 && (
        <div role="alert" className="rounded border border-[#f2b8b5] bg-[#fdecec] px-3 py-2 text-xs text-[#9e1b16]">
          <ul className="list-disc space-y-0.5 pl-4">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor={`${uid}-total`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Approved total *
          </label>
          <input
            id={`${uid}-total`}
            type="text"
            inputMode="decimal"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => {
              const n = parseMoney(total);
              if (n !== null) setTotal(formatMoneyInput(n));
            }}
            placeholder="95,000"
            className={`${formFieldClass} text-right font-mono tabular-nums`}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-currency`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Currency
          </label>
          <select
            id={`${uid}-currency`}
            value={currency}
            disabled={currencyLocked}
            onChange={(e) => setCurrency(e.target.value)}
            className={`${formFieldClass} disabled:bg-[#f1f3f6] disabled:text-[#5b6770]`}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {currencyLocked && <p className="mt-0.5 text-[11px] text-[#5b6770]">Fixed once a budget is approved.</p>}
        </div>
        <div>
          <label htmlFor={`${uid}-date`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Date confirmed *
          </label>
          <input
            id={`${uid}-date`}
            type="date"
            max={todayIso()}
            value={confirmedOn}
            onChange={(e) => setConfirmedOn(e.target.value)}
            className={formFieldClass}
          />
        </div>
        <div>
          <label htmlFor={`${uid}-by`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Authorised by *
          </label>
          <StakeholderSelect
            id={`${uid}-by`}
            label="Authorised by"
            value={authorisedBy}
            stakeholders={stakeholders}
            onChange={setAuthorisedBy}
            emptyLabel="Choose a key stakeholder"
            required
          />
          {stakeholders.length === 0 && (
            <p className="mt-0.5 text-[11px] text-[#5b6770]">
              No key stakeholders yet.{' '}
              {onManageStakeholders && (
                <button type="button" onClick={onManageStakeholders} className="focus-ring cursor-pointer rounded font-semibold text-[#0063a3] underline">
                  Add one
                </button>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-ref`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Reference
          </label>
          <input id={`${uid}-ref`} type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO or ticket number" className={formFieldClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-note`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">
            Note
          </label>
          <input id={`${uid}-note`} type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className={formFieldClass} />
        </div>
      </div>

      <fieldset className="rounded border border-[#d8dce0] bg-white p-3">
        <legend className="px-1 text-[11px] font-semibold text-[#252a2e]">Approved amount by category</legend>
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.categories.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <label htmlFor={`${uid}-${c.id}`} className="w-28 shrink-0 truncate text-xs text-[#252a2e]" title={c.name}>
                {c.name}
              </label>
              <input
                id={`${uid}-${c.id}`}
                type="text"
                inputMode="decimal"
                value={alloc[c.id] ?? ''}
                onChange={(e) => setAlloc((a) => ({ ...a, [c.id]: e.target.value }))}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => {
                  const n = parseMoney(alloc[c.id] ?? '');
                  setAlloc((a) => ({ ...a, [c.id]: n === null ? '' : formatMoneyInput(n) }));
                }}
                placeholder="0"
                className={`${formFieldClass} text-right font-mono tabular-nums`}
              />
              {canDeleteCategory(data, c.id) && !(parseMoney(alloc[c.id] ?? '') ?? 0) && (
                <button
                  type="button"
                  onClick={() => onCommit({ ...data, categories: data.categories.filter((x) => x.id !== c.id) })}
                  aria-label={`Remove category ${c.name}`}
                  title="Remove unused category"
                  className="focus-ring shrink-0 cursor-pointer rounded p-1 text-[#5b6770] hover:bg-[#fdecec] hover:text-[#da3832]"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#e7eaef] pt-2">
          <div className="flex items-center gap-2">
            <label htmlFor={`${uid}-newcat`} className="sr-only">
              New category name
            </label>
            <input
              id={`${uid}-newcat`}
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addNewCategory();
                }
              }}
              placeholder="New category"
              className={`${formFieldClass} w-40`}
            />
            <button
              type="button"
              onClick={addNewCategory}
              className="focus-ring cursor-pointer rounded border border-[#d8dce0] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#46535e] hover:border-[#0063a3] hover:text-[#0063a3]"
            >
              Add category
            </button>
          </div>
          <p role="status" className="text-xs" style={{ color: left < 0 ? '#9e1b16' : '#46535e' }}>
            {left < 0 ? (
              <span className="font-semibold">{money(Math.abs(left))} more than the approved total</span>
            ) : (
              <>
                Unallocated: <span className="font-mono font-semibold tabular-nums">{money(left)}</span>
              </>
            )}
          </p>
        </div>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="focus-ring cursor-pointer rounded border border-[#d8dce0] bg-white px-3 py-1.5 text-xs text-[#46535e] hover:border-[#0063a3]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={saveDraft}
          className="focus-ring cursor-pointer rounded border border-[#0063a3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0063a3] hover:bg-[#e5f2f8]"
        >
          Save as draft
        </button>
        <button
          type="submit"
          className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]"
        >
          Confirm budget
        </button>
      </div>
    </form>
  );
};
