import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Mail,
  MessageSquare,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import type { EventConfig, StaffMember } from '@/types';
import { toast } from '@/components/common/Toast';
import { cn } from '@/lib/utils';

interface ZeroHourDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: EventConfig;
  roster: StaffMember[];
  onNavigateToRoster?: () => void;
}

export const ZeroHourDrawer: React.FC<ZeroHourDrawerProps> = ({
  isOpen,
  onClose,
  config,
  roster,
  onNavigateToRoster,
}) => {
  const [copiedSlack, setCopiedSlack] = useState(false);
  const [copiedIndividualId, setCopiedIndividualId] = useState<string | null>(null);

  if (!isOpen) return null;

  const zeroHoursStaff = roster.filter((m) => m.totalBookedHours === 0);
  const publicUrl = `${window.location.origin}${window.location.pathname}#/event/${config.publicKey}`;

  // Slack reminder format specified by user prompt
  const slackMessage = `Hey team! We still have open expo floor slots for ${config.title}. If you haven't claimed your required ${config.targetHoursPerStaff} hours yet, please grab your shifts here: ${publicUrl} - Thanks!`;

  const handleCopySlackNudge = () => {
    navigator.clipboard.writeText(slackMessage);
    setCopiedSlack(true);
    toast.success('Slack reminder copied to clipboard! Paste into your team channel.', 'Copied to Clipboard');
    setTimeout(() => setCopiedSlack(false), 2500);
  };

  const handleCopyIndividualNudge = (member: StaffMember) => {
    const individualMsg = `Hi ${member.name}! Just a quick nudge regarding ${config.title}: you haven't claimed your required ${config.targetHoursPerStaff} hours for expo staffing yet. Please pick your slots here: ${publicUrl}`;
    navigator.clipboard.writeText(individualMsg);
    setCopiedIndividualId(member.id);
    toast.success(`Direct reminder for ${member.name} copied!`, 'Copied');
    setTimeout(() => setCopiedIndividualId(null), 2500);
  };

  const handleEmailAll = () => {
    const emails = zeroHoursStaff.map((m) => m.email).filter(Boolean).join(',');
    if (!emails) {
      toast.warning('No emails recorded for these staff members.');
      return;
    }
    const subject = `Expo Staffing Reminder: ${config.title}`;
    const body = `Hi everyone,\n\nWe are organizing the staff schedule for ${config.title} at ${config.location}.\n\nEach team member is asked to commit to ${config.targetHoursPerStaff} hours on the expo floor.\n\nPlease claim your open shifts using this self-service link:\n${publicUrl}\n\nThank you!`;
    window.location.href = `mailto:${emails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#252a2e]/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white border-l border-[#d8dce0] shadow-modus-4 flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="p-5 border-b border-[#d8dce0] flex items-start justify-between bg-[#f8f9fa]">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="p-1 rounded bg-[#fef8e8] text-[#8a5800] border border-[#f7c970]">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#fbad26]" />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8a5800]">
                  Accountability Drawer
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#252a2e] tracking-tight">
                Zero-Hours Team Members
              </h2>
              <p className="text-xs text-[#46535e]">
                {zeroHoursStaff.length} of {roster.length} team members have not claimed any shifts
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="focus-ring p-1.5 text-[#7c878e] hover:text-[#252a2e] rounded hover:bg-[#e7eaef] transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Banner: Copy Slack Nudge */}
          <div className="p-4 bg-[#e5f2f8] border-b border-[#b9dcf0] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0063a3] flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-[#0063a3]" />
                <span>Pre-Formatted Slack Nudge</span>
              </span>
              <span className="text-[11px] text-[#005084] font-semibold">1-Click Action</span>
            </div>

            <p className="text-[11px] text-[#252a2e] bg-white p-2.5 rounded border border-[#b9dcf0] font-mono italic leading-relaxed shadow-xs">
              &ldquo;{slackMessage}&rdquo;
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySlackNudge}
                className={cn(
                  'focus-ring flex-1 py-2 px-3 rounded text-xs font-semibold flex items-center justify-center space-x-2 transition-colors shadow-xs cursor-pointer',
                  copiedSlack
                    ? 'bg-[#00823b] text-white'
                    : 'bg-[#0063a3] hover:bg-[#005084] text-white'
                )}
              >
                {copiedSlack ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Slack Nudge</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleEmailAll}
                className="focus-ring py-2 px-3 bg-white hover:bg-[#f1f3f6] text-[#252a2e] rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-[#d8dce0] cursor-pointer shadow-xs"
                title="Open default email client with all unassigned staff in recipient list"
              >
                <Mail className="w-3.5 h-3.5 text-[#fbad26]" />
                <span>Email All</span>
              </button>
            </div>
          </div>

          {/* Member List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            <div className="text-xs font-semibold text-[#46535e] uppercase tracking-wider px-1">
              Uncommitted Staff ({zeroHoursStaff.length})
            </div>

            {zeroHoursStaff.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-[#e6f5ec] text-[#00823b] flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-[#252a2e]">Full Team Engagement!</div>
                <p className="text-xs text-[#46535e] max-w-xs mx-auto">
                  Every representative in the roster has claimed at least one expo staffing shift.
                </p>
              </div>
            ) : (
              zeroHoursStaff.map((member) => (
                <div
                  key={member.id}
                  className="bg-white border border-[#d8dce0] rounded p-3 flex items-center justify-between gap-3 hover:border-[#0063a3] transition-colors shadow-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-xs text-[#252a2e] truncate">
                        {member.name}
                      </span>
                      <span className="px-1.5 py-0.2 text-[10px] rounded bg-[#fdf2f2] text-[#da3832] border border-[#f5b5b3] font-mono font-bold">
                        0.0h
                      </span>
                    </div>
                    <div className="text-[11px] text-[#7c878e] font-mono truncate mt-0.5">
                      {member.email}
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyIndividualNudge(member)}
                      className={cn(
                        'focus-ring p-2 rounded text-xs transition-colors cursor-pointer',
                        copiedIndividualId === member.id
                          ? 'bg-[#e6f5ec] text-[#00823b]'
                          : 'bg-white text-[#46535e] hover:text-[#252a2e] hover:bg-[#f1f3f6] border border-[#d8dce0]'
                      )}
                      title={`Copy personal nudge for ${member.name}`}
                    >
                      {copiedIndividualId === member.id ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={`mailto:${member.email}?subject=${encodeURIComponent(`Expo Staffing Shifts: ${config.title}`)}&body=${encodeURIComponent(`Hi ${member.name},\n\nPlease grab your expo staffing shifts here:\n${publicUrl}`)}`}
                      className="focus-ring p-2 bg-white text-[#46535e] hover:text-[#0063a3] hover:bg-[#f1f3f6] border border-[#d8dce0] rounded text-xs transition-colors"
                      title={`Send email reminder to ${member.name}`}
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[#d8dce0] bg-[#f8f9fa] flex items-center justify-between">
            {onNavigateToRoster && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToRoster();
                }}
                className="focus-ring rounded text-xs text-[#0063a3] hover:text-[#005084] font-semibold transition-colors cursor-pointer"
              >
                Open Roster Audit &rarr;
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="focus-ring ml-auto px-4 py-2 bg-[#0063a3] hover:bg-[#005084] text-white text-xs font-semibold rounded transition-colors shadow-xs cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
