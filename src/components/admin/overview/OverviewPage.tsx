import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ChevronRight, Layers, LayoutDashboard, OctagonAlert, X } from 'lucide-react';
import type { EventConfig } from '@/types';
import type { AdminModuleCategory, AdminModuleItem } from '@/types/adminHub';
import type { ModuleState, ModuleSummary } from '@/types/moduleSummary';
import type { TasksData } from '@/types/tasks';
import { ADMIN_MODULES } from '@/data/adminModules';
import { usePageFocus } from '@/lib/hooks';
import { getModuleSummary } from '@/lib/moduleSummaries';
import { readModuleLocal } from '@/lib/moduleStore';
import { normaliseTasks, taskStats, TASKS_MODULE_ID } from '@/lib/tasks';
import { formatDate } from '@/lib/utils';
import { MODULE_ICONS } from '../moduleIcons';

interface OverviewPageProps {
  event: EventConfig;
  onBack: () => void;
  onOpenModule: (moduleId: string) => void;
}

const STATE_STYLE: Record<ModuleState, { label: string; text: string; bg: string; border: string }> = {
  needs_attention: { label: 'Needs attention', text: '#6e4600', bg: '#fef3d6', border: '#f1d68c' },
  in_progress: { label: 'In progress', text: '#004f83', bg: '#e5f2f8', border: '#b9dcf0' },
  complete: { label: 'Complete', text: '#005a28', bg: '#e6f5ec', border: '#b5dfc5' },
  not_started: { label: 'Not started', text: '#46535e', bg: '#f1f3f6', border: '#d8dce0' },
};

const STATE_ORDER: ModuleState[] = ['needs_attention', 'in_progress', 'complete', 'not_started'];
const CATEGORY_ORDER: AdminModuleCategory[] = ['Operations', 'Programming', 'Commercial', 'Logistics', 'General'];

const daysUntil = (iso: string): number | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return null;
  const now = new Date();
  const start = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((start - today) / 86400000);
};

export const OverviewPage: React.FC<OverviewPageProps> = ({ event, onBack, onOpenModule }) => {
  const modalRef = usePageFocus();
  const [filter, setFilter] = useState<ModuleState | 'all'>('all');

  const rows = useMemo(
    () =>
      ADMIN_MODULES.filter((m) => m.id !== 'overview').map((module) => ({
        module,
        summary: getModuleSummary(module.id, event.id),
      })),
    [event.id]
  );

  const counts = STATE_ORDER.reduce((acc, s) => ({ ...acc, [s]: rows.filter((r) => r.summary.state === s).length }), {} as Record<ModuleState, number>);
  const taskTotals = taskStats(normaliseTasks(readModuleLocal<TasksData>(event.id, TASKS_MODULE_ID)?.data).tasks);
  const days = daysUntil(event.startDate);

  const shown = rows.filter((r) => filter === 'all' || r.summary.state === filter);
  const groups = CATEGORY_ORDER.map((category) => ({ category, items: shown.filter((r) => r.module.category === category) })).filter((g) => g.items.length > 0);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section ref={modalRef} tabIndex={-1} aria-labelledby="overview-modal-title" className="flex flex-col rounded border border-[#d8dce0] bg-white shadow-xs focus:outline-hidden">
        <div className="p-4 sm:p-5 border-b border-[#d8dce0] bg-[#f8f9fa]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <button type="button" onClick={onBack} className="focus-ring p-2 rounded text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#b9dcf0] bg-white transition-colors cursor-pointer" title="Back to menu" aria-label="Back to menu">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-xs text-[#46535e]">{event.title}</p>
                <h1 id="overview-modal-title" className="text-lg font-bold text-[#252a2e] mt-0.5 flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5 text-[#0063a3]" aria-hidden="true" />
                  <span>Overview</span>
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f8f9fa] p-4 sm:p-5 space-y-4">
          <section aria-label="Event at a glance" className="rounded border border-[#d8dce0] bg-white p-4 shadow-2xs">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <div>
                <dt className="text-[11px] font-semibold text-[#5b6770]">Event starts</dt>
                <dd className="mt-0.5 text-sm font-bold text-[#252a2e]">{formatDate(event.startDate) || 'Not set'}</dd>
                {days !== null && (
                  <dd className="text-[11px] text-[#5b6770]">{days > 0 ? `in ${days} ${days === 1 ? 'day' : 'days'}` : days === 0 ? 'today' : `${-days} ${days === -1 ? 'day' : 'days'} ago`}</dd>
                )}
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-[#5b6770]">Areas needing attention</dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums" style={{ color: counts.needs_attention > 0 ? '#6e4600' : '#252a2e' }}>
                  {counts.needs_attention}
                </dd>
                <dd className="text-[11px] text-[#5b6770]">of {rows.length}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-[#5b6770]">Open tasks</dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums text-[#252a2e]">{taskTotals.open}</dd>
                <dd className="text-[11px] text-[#5b6770]">across the event</dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-[#5b6770]">Overdue tasks</dt>
                <dd className="mt-0.5 font-mono text-lg font-bold tabular-nums" style={{ color: taskTotals.overdue > 0 ? '#9e1b16' : '#252a2e' }}>
                  {taskTotals.overdue}
                </dd>
              </div>
            </dl>
          </section>

          <div role="group" aria-label="Filter areas by state" className="flex flex-wrap gap-2">
            {(['all', ...STATE_ORDER] as const).map((s) => {
              const active = filter === s;
              const n = s === 'all' ? rows.length : counts[s];
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(s)}
                  className={`focus-ring cursor-pointer rounded border px-2.5 py-1 text-xs font-semibold transition-colors ${
                    active ? 'border-[#0063a3] bg-[#0063a3] text-white' : 'border-[#d8dce0] bg-white text-[#46535e] hover:border-[#0063a3] hover:text-[#0063a3]'
                  }`}
                >
                  {s === 'all' ? 'All' : STATE_STYLE[s].label} <span className="font-mono tabular-nums opacity-80">{n}</span>
                </button>
              );
            })}
          </div>

          {groups.length === 0 && <p className="rounded border border-dashed border-[#c5ccd3] px-3 py-8 text-center text-xs text-[#5b6770]">No areas in this state.</p>}

          {groups.map((group) => (
            <section key={group.category} aria-labelledby={`ov-${group.category}`}>
              <h2 id={`ov-${group.category}`} className="mb-1.5 text-xs font-bold uppercase tracking-wider text-[#46535e]">
                {group.category}
              </h2>
              <ul className="divide-y divide-[#e7eaef] rounded border border-[#d8dce0] bg-white shadow-2xs">
                {group.items.map(({ module, summary }) => (
                  <OverviewRow key={module.id} module={module} summary={summary} onOpen={() => onOpenModule(module.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
};

const OverviewRow: React.FC<{ module: AdminModuleItem; summary: ModuleSummary; onOpen: () => void }> = ({ module, summary, onOpen }) => {
  const Icon = MODULE_ICONS[module.iconName] || Layers;
  const style = STATE_STYLE[summary.state];
  return (
    <li>
      <button type="button" onClick={onOpen} className="focus-ring group flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-[#f0f7fb]">
        <span className="mt-0.5 shrink-0 rounded border border-[#b9dcf0] bg-[#e5f2f8] p-1.5 text-[#0063a3]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-[#252a2e]">{module.title}</span>
            <span className="rounded border px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: style.text, background: style.bg, borderColor: style.border }}>
              {style.label}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-[#46535e]">{summary.headline}</span>
          {summary.attention.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {summary.attention.map((a) => (
                <li key={a.label} className="flex items-start gap-1.5 text-xs" style={{ color: a.severity === 'critical' ? '#9e1b16' : '#6e4600' }}>
                  {a.severity === 'critical' ? <OctagonAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  <span>
                    <span className="sr-only">{a.severity === 'critical' ? 'Critical: ' : 'Warning: '}</span>
                    {a.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </span>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#9aa5ad] transition-transform group-hover:translate-x-0.5 group-hover:text-[#0063a3] motion-reduce:transition-none" aria-hidden="true" />
      </button>
    </li>
  );
};
