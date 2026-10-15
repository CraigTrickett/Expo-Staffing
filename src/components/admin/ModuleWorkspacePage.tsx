import React from 'react';
import { ArrowLeft, Layers, X } from 'lucide-react';
import type { EventConfig } from '@/types';
import type { AdminModuleItem } from '@/types/adminHub';
import { usePageFocus } from '@/lib/hooks';
import { MODULE_ICONS } from './moduleIcons';
import { ModuleEssentialsPanel } from './essentials/ModuleEssentialsPanel';

interface ModuleWorkspacePageProps {
  module: AdminModuleItem;
  event: EventConfig;
  onBack: () => void;
  onOpenModule: (moduleId: string) => void;
}

/**
 * The screen for any module that has no tools of its own yet. It still does
 * useful work: links, a point of contact and tasks. What the module will
 * eventually do is kept below, so the plan stays visible without being the point.
 */
export const ModuleWorkspacePage: React.FC<ModuleWorkspacePageProps> = ({ module, event, onBack, onOpenModule }) => {
  const modalRef = usePageFocus();
  const Icon = MODULE_ICONS[module.iconName] || Layers;
  const planned = module.status === 'coming_soon';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <section ref={modalRef} tabIndex={-1} aria-labelledby="workspace-modal-title" className="flex flex-col rounded border border-[#d8dce0] bg-white shadow-xs focus:outline-hidden">
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
                <h1 id="workspace-modal-title" className="text-lg font-bold text-[#252a2e] mt-0.5 flex items-center gap-2">
                  <Icon className="w-5 h-5 text-[#0063a3]" aria-hidden="true" />
                  <span>{module.title}</span>
                </h1>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#f8f9fa] p-4 sm:p-5 space-y-4">
          {planned && (
            <p className="text-xs text-[#46535e]">Not built yet. Keep links, a contact and tasks here for now.</p>
          )}

          <ModuleEssentialsPanel event={event} moduleId={module.id} moduleTitle={module.title} onManageStakeholders={() => onOpenModule('key-stakeholders')} />

        </div>
      </section>
    </div>
  );
};
