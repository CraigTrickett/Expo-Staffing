import React, { useState } from 'react';
import {
  X,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Calendar,
  Layers,
  Send,
  Bell,
  Store,
  Users,
  Clock,
  BadgeDollarSign,
  Gift,
  Mic,
  CalendarRange,
  FolderOpen,
  PartyPopper,
  Calculator,
  Megaphone,
  Truck,
  IdCard,
  Utensils,
  ShieldAlert,
} from 'lucide-react';
import type { AdminModuleItem } from '@/types/adminHub';
import type { EventConfig } from '@/types';
import { useModalA11y } from '@/lib/hooks';
import { toast } from '@/components/common/Toast';

const iconMap: Record<string, React.ElementType> = {
  Store,
  Users,
  Clock,
  BadgeDollarSign,
  Gift,
  Mic,
  CalendarRange,
  FolderOpen,
  PartyPopper,
  Calculator,
  Megaphone,
  Truck,
  IdCard,
  Utensils,
  ShieldAlert,
};

interface AdminModuleOverviewModalProps {
  module: AdminModuleItem;
  event: EventConfig;
  onBack: () => void;
  onClose: () => void;
}

export const AdminModuleOverviewModal: React.FC<AdminModuleOverviewModalProps> = ({
  module,
  event,
  onBack,
  onClose,
}) => {
  const modalRef = useModalA11y(true, onClose);
  const [emailNotification, setEmailNotification] = useState('');
  const [hasSubscribed, setHasSubscribed] = useState(() => {
    try {
      const stored = localStorage.getItem(`notify_${module.id}`);
      return Boolean(stored);
    } catch {
      return false;
    }
  });

  const IconComponent = iconMap[module.iconName] || Layers;

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailNotification.trim() || !emailNotification.includes('@')) {
      toast.error('Please enter a valid work email address.', 'Invalid Email');
      return;
    }
    try {
      localStorage.setItem(`notify_${module.id}`, emailNotification.trim());
      setHasSubscribed(true);
      toast.success(
        `We will notify ${emailNotification} when "${module.title}" becomes available!`,
        'Preferences Saved'
      );
    } catch {
      setHasSubscribed(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs modal-scrim">
      <div
        ref={modalRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="module-modal-title"
        className="modal-panel bg-white border border-[#d8dce0] rounded max-w-2xl w-full max-h-[88vh] flex flex-col shadow-modus-3 focus:outline-hidden overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 border-b border-[#d8dce0] bg-white">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 rounded bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0] shrink-0 mt-0.5">
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="module-modal-title" className="text-lg font-bold text-[#252a2e]">
                  {module.title}
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-[#fef3eb] text-[#d97316] border border-[#fbd38d]">
                  {module.badgeText || 'Planned Feature'}
                </span>
                <span className="text-[11px] font-medium text-[#5b6770] px-2 py-0.5 rounded bg-[#f1f3f6]">
                  {module.category}
                </span>
              </div>
              <p className="text-xs text-[#46535e] mt-1 font-medium">
                Targeting: <span className="font-semibold text-[#252a2e]">{event.title}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="focus-ring p-1.5 text-[#46535e] hover:text-[#0063a3] hover:bg-[#f1f3f6] rounded transition-colors cursor-pointer flex items-center space-x-1 text-xs font-semibold"
              title="Return to Admin Areas"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring p-1.5 text-[#5b6770] hover:text-[#252a2e] hover:bg-[#f1f3f6] rounded transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Headline & Overview */}
          <div className="bg-[#f8f9fa] border border-[#d8dce0] rounded p-4 space-y-2">
            <h3 className="text-sm font-bold text-[#0063a3] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#fbad26]" />
              <span>{module.featureOverview.headline}</span>
            </h3>
            <p className="text-xs text-[#46535e] leading-relaxed">
              {module.featureOverview.summary}
            </p>
          </div>

          {/* Key Capabilities */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#252a2e] mb-3 flex items-center gap-1.5">
              <span>Planned Capabilities for Expo Organizers</span>
            </h4>
            <div className="grid grid-cols-1 gap-2.5">
              {module.featureOverview.keyCapabilities.map((cap, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-2.5 p-2.5 rounded bg-white border border-[#e5e9ec] hover:border-[#b9dcf0] transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#0063a3] shrink-0 mt-0.5" />
                  <span className="text-xs text-[#252a2e] font-normal leading-normal">{cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Development Roadmap */}
          <div className="border-t border-[#e5e9ec] pt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#5b6770] mb-2.5">
              Roadmap & Milestones
            </h4>
            <div className="space-y-2">
              {module.featureOverview.upcomingMilestones.map((milestone, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-xs text-[#46535e]">
                  <span className="w-2 h-2 rounded-full bg-[#0063a3] shrink-0" />
                  <span>{milestone}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stay Updated / Interest box */}
          <div className="bg-[#e5f2f8]/50 border border-[#b9dcf0] rounded p-4">
            <div className="flex items-start space-x-3">
              <div className="p-1.5 rounded bg-[#0063a3] text-white shrink-0 mt-0.5">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <h5 className="text-xs font-bold text-[#0063a3]">
                  Want early access to the {module.title} workspace?
                </h5>
                <p className="text-[11px] text-[#46535e] mt-0.5 mb-3">
                  Leave your email and we'll notify you as soon as this module enters staging for your event.
                </p>

                {hasSubscribed ? (
                  <div className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#0063a3] bg-white px-3 py-1.5 rounded border border-[#b9dcf0]">
                    <CheckCircle2 className="w-4 h-4 text-[#4ade80]" />
                    <span>You're on the early access list for this module.</span>
                  </div>
                ) : (
                  <form onSubmit={handleNotifySubmit} className="flex flex-col sm:flex-row gap-2 max-w-md">
                    <input
                      type="email"
                      value={emailNotification}
                      onChange={(e) => setEmailNotification(e.target.value)}
                      placeholder="colleague@trimble.com"
                      className="bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 flex-1"
                    />
                    <button
                      type="submit"
                      className="focus-ring px-3 py-1.5 bg-[#0063a3] hover:bg-[#005084] text-white rounded text-xs font-semibold shadow-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                    >
                      <Send className="w-3 h-3" />
                      <span>Notify Me</span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#d8dce0] bg-[#f8f9fa] flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="focus-ring px-3 py-1.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#0063a3] border border-[#d8dce0] hover:border-[#0063a3] bg-white transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin Hub</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="focus-ring px-4 py-1.5 rounded text-xs font-semibold bg-[#252a2e] hover:bg-[#1a1d20] text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
