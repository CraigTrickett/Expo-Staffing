import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Calculator, X } from 'lucide-react';
import type { EventConfig } from '@/types';
import type { BudgetData } from '@/types/budget';
import { usePageFocus } from '@/lib/hooks';
import { getStakeholders } from '@/lib/stakeholders';
import { createEmptyBudget, normaliseBudget } from '@/lib/budget';
import { loadModule, pullModule, saveModule } from '@/lib/moduleStore';
import type { SyncStatus } from '@/lib/moduleStore';
import { BudgetSummary } from './BudgetSummary';
import { ApprovalPanel } from './ApprovalPanel';
import { CostLinesPanel } from './CostLinesPanel';

export const BUDGET_MODULE_ID = 'budget';

interface BudgetPageProps {
  event: EventConfig;
  onBack: () => void;
  onManageStakeholders?: () => void;
}

type SaveState = SyncStatus | 'saving' | 'checking';

const SYNC_TEXT: Record<SaveState, { text: string; tone: string }> = {
  checking: { text: '', tone: '#5b6770' },
  saving: { text: 'Saving\u2026', tone: '#5b6770' },
  synced: { text: 'Saved and shared', tone: '#005a28' },
  local_only: { text: 'Saved on this device. Shared storage is not set up.', tone: '#46535e' },
  not_synced: { text: 'Saved on this device only. Sign in as admin to share it.', tone: '#6e4600' },
};

export const BudgetPage: React.FC<BudgetPageProps> = ({ event, onBack, onManageStakeholders }) => {
  const modalRef = usePageFocus();
  const stakeholders = useMemo(() => getStakeholders(event.id), [event.id]);
  const [data, setData] = useState<BudgetData>(() =>
    normaliseBudget(loadModule<BudgetData>(event.id, BUDGET_MODULE_ID, createEmptyBudget).data)
  );
  const [saveState, setSaveState] = useState<SaveState>('checking');
  const saveSeq = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Bring in a newer shared copy if one exists, then show how this one stands.
  useEffect(() => {
    let cancelled = false;
    pullModule<BudgetData>(event.id, BUDGET_MODULE_ID).then((result) => {
      if (cancelled) return;
      if (result.kind === 'updated') setData(normaliseBudget(result.envelope.data));
      setSaveState(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  const commit = useCallback(
    (next: BudgetData) => {
      setData(next);
      setSaveState('saving');
      const seq = ++saveSeq.current;
      saveModule(event.id, BUDGET_MODULE_ID, next).then(({ status }) => {
        // Only the latest save reports; an older one finishing late must not overwrite it.
        if (mounted.current && seq === saveSeq.current) setSaveState(status);
      });
    },
    [event.id]
  );

  const sync = SYNC_TEXT[saveState];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section ref={modalRef} tabIndex={-1} aria-labelledby="budget-modal-title" className="flex flex-col rounded border border-[#d8dce0] bg-white shadow-xs focus:outline-hidden">
        <div className="p-4 sm:p-5 border-b border-[#d8dce0] bg-[#f8f9fa]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <button
                type="button"
                onClick={onBack}
                className="focus-ring p-2 rounded text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#b9dcf0] bg-white transition-colors cursor-pointer"
                title="Back to menu"
                aria-label="Back to menu"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-xs text-[#46535e]">{event.title}</p>
                <h1 id="budget-modal-title" className="text-lg font-bold text-[#252a2e] mt-0.5 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-[#0063a3]" aria-hidden="true" />
                  <span>Budget</span>
                </h1>
                <p role="status" className="mt-1 min-h-4 text-[11px]" style={{ color: sync.tone }}>
                  {sync.text}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f8f9fa] p-4 sm:p-5 space-y-4">
          <BudgetSummary data={data} />
          <ApprovalPanel data={data} stakeholders={stakeholders} onCommit={commit} onManageStakeholders={onManageStakeholders} />
          <CostLinesPanel data={data} stakeholders={stakeholders} onCommit={commit} />
        </div>
      </section>
    </div>
  );
};
