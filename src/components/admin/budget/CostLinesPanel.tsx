import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronRight, Lock, LockOpen, Plus, ReceiptText, Trash2 } from 'lucide-react';
import type { KeyStakeholder } from '@/types';
import type { BudgetData, CostLine } from '@/types/budget';
import { canClose, currentFigure, currentFigureKind, formatMoney, parseMoney, categoryRollups } from '@/lib/budget';
import type { StakeholderRef } from '@/types/stakeholderRef';
import { InlineMoney, InlineText, inlineFieldClass } from '@/components/common/InlineField';
import { StakeholderSelect, formFieldClass } from '@/components/common/StakeholderSelect';
import { toast } from '@/components/common/Toast';

const COLUMNS =
  'grid-cols-[minmax(180px,1.6fr)_minmax(110px,1fr)_minmax(130px,1fr)_112px_112px_112px_118px_104px]';

const KIND_LABEL = { forecast: 'forecast', committed: 'committed', actual: 'actual' } as const;

interface CostLinesPanelProps {
  data: BudgetData;
  stakeholders: KeyStakeholder[];
  onCommit: (next: BudgetData) => void;
}

export const CostLinesPanel: React.FC<CostLinesPanelProps> = ({ data, stakeholders, onCommit }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [openDetails, setOpenDetails] = useState<Set<string>>(new Set());
  const [removed, setRemoved] = useState<{ line: CostLine; index: number } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const dataRef = useRef(data);
  dataRef.current = data;

  const money = (n: number) => formatMoney(n, data.currency);
  const rollups = useMemo(() => new Map(categoryRollups(data).map((r) => [r.category.id, r])), [data]);

  const update = (id: string, patch: Partial<CostLine>) =>
    onCommit({ ...dataRef.current, lines: dataRef.current.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const toggleClosed = (line: CostLine) => {
    if (!line.closed && !canClose(line)) {
      toast.error('Add the actual cost before marking this line final.', 'Cannot close yet');
      return;
    }
    update(line.id, { closed: !line.closed });
    setAnnouncement(`${line.description} marked ${line.closed ? 'open' : 'final'}.`);
  };

  const remove = (id: string) => {
    const lines = dataRef.current.lines;
    const index = lines.findIndex((l) => l.id === id);
    if (index < 0) return;
    setRemoved({ line: lines[index], index });
    onCommit({ ...dataRef.current, lines: lines.filter((l) => l.id !== id) });
    setAnnouncement(`Removed ${lines[index].description}. Undo is available.`);
  };

  const undo = () => {
    if (!removed) return;
    const lines = [...dataRef.current.lines];
    lines.splice(Math.min(removed.index, lines.length), 0, removed.line);
    onCommit({ ...dataRef.current, lines });
    setAnnouncement(`Restored ${removed.line.description}.`);
    setRemoved(null);
  };

  useEffect(() => {
    if (!removed) return;
    const t = window.setTimeout(() => setRemoved(null), 8000);
    return () => window.clearTimeout(t);
  }, [removed]);

  const toggleDetails = (id: string) =>
    setOpenDetails((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Lines whose category was somehow lost still show, under a catch-all group.
  const knownIds = new Set(data.categories.map((c) => c.id));
  const orphaned = data.lines.filter((l) => !knownIds.has(l.categoryId));
  const groups = [
    ...data.categories.map((c) => ({ id: c.id, name: c.name, lines: data.lines.filter((l) => l.categoryId === c.id) })),
    ...(orphaned.length ? [{ id: '__none', name: 'Uncategorised', lines: orphaned }] : []),
  ].filter((g) => g.lines.length > 0);

  return (
    <section aria-labelledby="cost-lines-heading" className="space-y-3 rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="cost-lines-heading" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#252a2e]">
            <ReceiptText className="h-4 w-4 text-[#0063a3]" aria-hidden="true" />
            Cost Lines
          </h2>
          <p className="mt-0.5 text-[11px] text-[#5b6770]">
            Forecast first, then committed once ordered, then actual once invoiced. The latest figure counts.
          </p>
        </div>
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="focus-ring flex cursor-pointer items-center gap-1 rounded bg-[#0063a3] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#005084]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add cost line
          </button>
        )}
      </div>

      {isAdding && (
        <AddLineForm
          data={data}
          stakeholders={stakeholders}
          onAdd={(line) => {
            onCommit({ ...dataRef.current, lines: [...dataRef.current.lines, line] });
            setIsAdding(false);
            setAnnouncement(`Added ${line.description}.`);
          }}
          onCancel={() => setIsAdding(false)}
        />
      )}

      {data.lines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded border border-dashed border-[#c5ccd3] px-4 py-10 text-center">
          <ReceiptText className="h-5 w-5 text-[#5b6770]" aria-hidden="true" />
          <p className="text-xs font-semibold text-[#252a2e]">No cost lines yet</p>
        </div>
      ) : (
        <div role="table" aria-label="Cost lines" className="overflow-x-auto rounded border border-[#d8dce0]">
          <div className="min-w-[1000px]">
            <div
              role="row"
              className={`grid ${COLUMNS} items-center border-b border-[#d8dce0] bg-[#f8f9fa] px-1 py-2 text-[11px] font-semibold text-[#5b6770]`}
            >
              <div role="columnheader" className="px-2">Description</div>
              <div role="columnheader" className="px-2">Vendor</div>
              <div role="columnheader" className="px-2">Owner</div>
              <div role="columnheader" className="px-2 text-right">Forecast</div>
              <div role="columnheader" className="px-2 text-right">Committed</div>
              <div role="columnheader" className="px-2 text-right">Actual</div>
              <div role="columnheader" className="px-2 text-right">Current</div>
              <div role="columnheader" className="px-2 text-right">
                <span className="sr-only">Actions</span>
              </div>
            </div>

            {groups.map((group) => {
              const r = rollups.get(group.id);
              return (
                <div key={group.id} role="rowgroup" aria-label={group.name}>
                  <div role="row" className="flex items-baseline justify-between gap-3 border-b border-[#e7eaef] bg-[#f1f3f6] px-3 py-1.5">
                    <span role="rowheader" className="text-xs font-bold text-[#252a2e]">{group.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-[#46535e]">
                      {money(r?.forecast ?? group.lines.reduce((s, l) => s + currentFigure(l), 0))} forecast
                      {r && r.approved > 0 && <> of {money(r.approved)}</>}
                    </span>
                  </div>
                  <div className="divide-y divide-[#e7eaef]">
                    {group.lines.map((line) => (
                      <LineRow
                        key={line.id}
                        line={line}
                        stakeholders={stakeholders}
                        detailsOpen={openDetails.has(line.id)}
                        money={money}
                        onToggleDetails={() => toggleDetails(line.id)}
                        onUpdate={update}
                        onToggleClosed={toggleClosed}
                        onRemove={remove}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {removed && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded border border-[#d8dce0] bg-[#f8f9fa] px-3 py-2 text-xs text-[#252a2e] animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
        >
          <span className="min-w-0 truncate">
            Removed <span className="font-semibold">&ldquo;{removed.line.description}&rdquo;</span>
          </span>
          <button
            type="button"
            onClick={undo}
            className="focus-ring shrink-0 cursor-pointer rounded px-2 py-0.5 font-semibold text-[#0063a3] hover:bg-[#e5f2f8]"
          >
            Undo
          </button>
        </div>
      )}

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

const LineRow: React.FC<{
  line: CostLine;
  stakeholders: KeyStakeholder[];
  detailsOpen: boolean;
  money: (n: number) => string;
  onToggleDetails: () => void;
  onUpdate: (id: string, patch: Partial<CostLine>) => void;
  onToggleClosed: (line: CostLine) => void;
  onRemove: (id: string) => void;
}> = ({ line, stakeholders, detailsOpen, money, onToggleDetails, onUpdate, onToggleClosed, onRemove }) => {
  const uid = useId();
  const kind = currentFigureKind(line);
  const locked = line.closed;

  return (
    <div role="row" className="bg-white">
      <div className={`grid ${COLUMNS} items-start px-1 py-1.5`}>
        <div role="cell">
          <InlineText
            value={line.description}
            label={`Description for ${line.description}`}
            required
            requiredMessage="A cost line needs a description."
            semibold
            onCommit={(next) => onUpdate(line.id, { description: next })}
          />
        </div>
        <div role="cell">
          <InlineText
            value={line.vendor ?? ''}
            label={`Vendor for ${line.description}`}
            placeholder="Add vendor"
            onCommit={(next) => onUpdate(line.id, { vendor: next || undefined })}
          />
        </div>
        <div role="cell">
          <StakeholderSelect
            variant="inline"
            label={`Owner of ${line.description}`}
            emptyLabel="No owner"
            value={line.owner}
            stakeholders={stakeholders}
            onChange={(ref) => onUpdate(line.id, { owner: ref ?? undefined })}
          />
        </div>
        <div role="cell">
          <InlineMoney
            value={line.forecast}
            label={`Forecast for ${line.description}`}
            disabled={locked}
            onCommit={(n) => n !== undefined && onUpdate(line.id, { forecast: n })}
          />
        </div>
        <div role="cell">
          <InlineMoney
            value={line.committed}
            optional
            label={`Committed amount for ${line.description}`}
            placeholder={'\u2013'}
            disabled={locked}
            onCommit={(n) => onUpdate(line.id, { committed: n })}
          />
        </div>
        <div role="cell">
          <InlineMoney
            value={line.actual}
            optional
            label={`Actual cost for ${line.description}`}
            placeholder={'\u2013'}
            disabled={locked}
            onCommit={(n) => onUpdate(line.id, { actual: n })}
          />
        </div>
        <div role="cell" className="px-2 pt-1 text-right">
          <div className="font-mono text-xs font-bold tabular-nums text-[#252a2e]">{money(currentFigure(line))}</div>
          <div className="text-[11px] text-[#5b6770]">{locked ? 'final' : KIND_LABEL[kind]}</div>
        </div>
        <div role="cell" className="flex items-center justify-end gap-0.5 pr-1 pt-0.5">
          <button
            type="button"
            onClick={onToggleDetails}
            aria-expanded={detailsOpen}
            aria-controls={`${uid}-details`}
            aria-label={`${detailsOpen ? 'Hide' : 'Show'} details for ${line.description}`}
            title="Details"
            className="focus-ring cursor-pointer rounded p-1 text-[#5b6770] hover:bg-[#e5f2f8] hover:text-[#0063a3]"
          >
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none ${detailsOpen ? 'rotate-90' : ''}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={() => onToggleClosed(line)}
            aria-pressed={locked}
            aria-label={locked ? `Reopen ${line.description}` : `Mark ${line.description} final`}
            title={locked ? 'Final. Reopen to edit' : 'Mark final'}
            className={`focus-ring cursor-pointer rounded p-1 transition-colors ${
              locked ? 'bg-[#e6f5ec] text-[#005a28]' : 'text-[#5b6770] hover:bg-[#e5f2f8] hover:text-[#0063a3]'
            }`}
          >
            {locked ? <Lock className="h-3.5 w-3.5" aria-hidden="true" /> : <LockOpen className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={() => onRemove(line.id)}
            aria-label={`Remove ${line.description}`}
            title="Remove cost line"
            className="focus-ring cursor-pointer rounded p-1 text-[#da3832] hover:bg-[#fdecec]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        id={`${uid}-details`}
        inert={!detailsOpen}
        className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
          detailsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="grid grid-cols-1 gap-3 border-t border-[#e7eaef] bg-[#f8f9fa] px-4 py-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="PO number">
              <InlineText value={line.poNumber ?? ''} label={`PO number for ${line.description}`} placeholder="Add PO" onCommit={(n) => onUpdate(line.id, { poNumber: n || undefined })} className="border-[#d8dce0] bg-white" />
            </DetailField>
            <DetailField label="Invoice date">
              <input type="date" aria-label={`Invoice date for ${line.description}`} value={line.invoiceDate ?? ''} onChange={(e) => onUpdate(line.id, { invoiceDate: e.target.value || undefined })} className={`${inlineFieldClass} border-[#d8dce0] bg-white`} />
            </DetailField>
            <DetailField label="Payment due">
              <input type="date" aria-label={`Payment due date for ${line.description}`} value={line.dueDate ?? ''} onChange={(e) => onUpdate(line.id, { dueDate: e.target.value || undefined })} className={`${inlineFieldClass} border-[#d8dce0] bg-white`} />
            </DetailField>
            <DetailField label="Notes">
              <InlineText value={line.notes ?? ''} label={`Notes for ${line.description}`} placeholder="Add notes" onCommit={(n) => onUpdate(line.id, { notes: n || undefined })} className="border-[#d8dce0] bg-white" />
            </DetailField>
          </div>
        </div>
      </div>
    </div>
  );
};

const DetailField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="mb-1 text-[11px] font-semibold text-[#5b6770]">{label}</div>
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* Add form                                                            */
/* ------------------------------------------------------------------ */

const AddLineForm: React.FC<{
  data: BudgetData;
  stakeholders: KeyStakeholder[];
  onAdd: (line: CostLine) => void;
  onCancel: () => void;
}> = ({ data, stakeholders, onAdd, onCancel }) => {
  const uid = useId();
  const [categoryId, setCategoryId] = useState(data.categories[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [vendor, setVendor] = useState('');
  const [owner, setOwner] = useState<StakeholderRef | null>(null);
  const [forecast, setForecast] = useState('');
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    descRef.current?.focus();
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseMoney(forecast);
    if (!description.trim()) {
      toast.error('Describe the cost.', 'Missing field');
      descRef.current?.focus();
      return;
    }
    if (amount === null) {
      toast.error('Enter a forecast amount such as 1,250.50.', 'Missing field');
      return;
    }
    if (!categoryId) {
      toast.error('Choose a category.', 'Missing field');
      return;
    }
    onAdd({
      id: `line_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      categoryId,
      description: description.trim(),
      vendor: vendor.trim() || undefined,
      owner: owner ?? undefined,
      forecast: amount,
      closed: false,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onCancel();
        }
      }}
      aria-label="Add cost line"
      className="space-y-3 rounded border border-[#b9dcf0] bg-[#f8f9fa] p-4 animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label htmlFor={`${uid}-cat`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Category *</label>
          <select id={`${uid}-cat`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={formFieldClass}>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label htmlFor={`${uid}-desc`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Description *</label>
          <input id={`${uid}-desc`} ref={descRef} type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Booth carpet and furniture rental" className={formFieldClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-vendor`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Vendor</label>
          <input id={`${uid}-vendor`} type="text" value={vendor} onChange={(e) => setVendor(e.target.value)} className={formFieldClass} />
        </div>
        <div>
          <label htmlFor={`${uid}-forecast`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Forecast *</label>
          <input id={`${uid}-forecast`} type="text" inputMode="decimal" value={forecast} onChange={(e) => setForecast(e.target.value)} placeholder="0" className={`${formFieldClass} text-right font-mono tabular-nums`} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label htmlFor={`${uid}-owner`} className="mb-1 block text-[11px] font-semibold text-[#252a2e]">Owner</label>
          <StakeholderSelect id={`${uid}-owner`} label="Owner" value={owner} stakeholders={stakeholders} onChange={setOwner} emptyLabel="No owner" />
        </div>
        <div className="flex items-end justify-end gap-2 lg:col-span-3">
          <button type="button" onClick={onCancel} className="focus-ring cursor-pointer rounded border border-[#d8dce0] bg-white px-3 py-1.5 text-xs text-[#46535e] hover:border-[#0063a3]">
            Cancel
          </button>
          <button type="submit" className="focus-ring cursor-pointer rounded bg-[#0063a3] px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#005084]">
            Add cost line
          </button>
        </div>
      </div>
    </form>
  );
};
