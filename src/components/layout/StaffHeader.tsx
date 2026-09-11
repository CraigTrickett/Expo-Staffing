import React, { useState } from 'react';
import {
  Calendar,
  Check,
  Download,
  MapPin,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import type { EventConfig, StaffMember } from '@/types';
import { formatDate, formatTime12h, cn } from '@/lib/utils';
import { downloadIcs, generateIcsFile } from '@/lib/calendar';
import { useBoothDutyStore } from '@/store';

interface StaffHeaderProps {
  config: EventConfig;
  currentIdentity: StaffMember | null;
  onSelectIdentity: (member: StaffMember | null) => void;
  onClaimNewIdentity: (name: string, email?: string) => void;
}

export const StaffHeader: React.FC<StaffHeaderProps> = ({
  config,
  currentIdentity,
  onSelectIdentity,
  onClaimNewIdentity,
}) => {
  const { roster, slots } = useBoothDutyStore();
  const [showNewUserDialog, setShowNewUserDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  // Calculate shifts booked for current user
  const mySlots = currentIdentity
    ? slots.filter((s) => s.bookings.some((b) => b.staffId === currentIdentity.id))
    : [];

  const handleDownloadMyCalendar = () => {
    if (!currentIdentity) return;
    const myBookings: { slot: (typeof slots)[0]; booking: (typeof slots)[0]['bookings'][0] }[] = [];
    for (const slot of mySlots) {
      const b = slot.bookings.find((item) => item.staffId === currentIdentity.id);
      if (b) {
        myBookings.push({ slot, booking: b });
      }
    }
    const ics = generateIcsFile(config, myBookings);
    const filename = `${config.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${currentIdentity.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-shifts.ics`;
    downloadIcs(filename, ics);
  };

  const handleCreateNewRep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onClaimNewIdentity(newName.trim(), newEmail.trim() || undefined);
    setShowNewUserDialog(false);
    setNewName('');
    setNewEmail('');
  };

  const progressPercent = currentIdentity
    ? Math.min(100, Math.round((currentIdentity.totalBookedHours / currentIdentity.targetHours) * 100))
    : 0;

  return (
    <div className="bg-white border-b border-[#d8dce0] shadow-xs">
      {/* Top Event Summary */}
      <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0]">
                <Users className="w-3 h-3 text-[#0063a3]" />
                <span>Expo Staffing</span>
              </span>
              <span className="text-xs text-[#7c878e] font-mono">Public Roster</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252a2e] truncate">
              {config.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#46535e] pt-0.5">
              <span className="flex items-center space-x-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#7c878e]" />
                <span>
                  {formatDate(config.startDate)} &ndash; {formatDate(config.endDate)}
                </span>
              </span>
              <span className="flex items-center space-x-1.5 font-mono">
                <span>
                  {formatTime12h(config.dailyStartTime)} &ndash; {formatTime12h(config.dailyEndTime)}
                </span>
              </span>
              {config.location && (
                <span className="flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#7c878e]" />
                  <span className="truncate max-w-xs">{config.location}</span>
                </span>
              )}
            </div>
          </div>

          {/* Quick Shift Export */}
          {currentIdentity && mySlots.length > 0 && (
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleDownloadMyCalendar}
                className="px-3.5 py-2 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white transition-colors flex items-center space-x-2 shadow-xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export My Shifts ({mySlots.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Identity Claim Bar */}
      <div className="bg-[#f8f9fa] border-t border-[#d8dce0] py-2.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Identity selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[#46535e] flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-[#0063a3]" />
              <span>I am claiming shifts as:</span>
            </span>

            <select
              aria-label="Select staff member"
              value={currentIdentity?.id || ''}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setShowNewUserDialog(true);
                } else {
                  const member = roster.find((r) => r.id === e.target.value) || null;
                  onSelectIdentity(member);
                }
              }}
              className="bg-white border border-[#d8dce0] text-[#252a2e] text-xs rounded px-3 py-1.5 font-medium focus:outline-none focus:border-[#0063a3] shadow-xs"
            >
              <option value="" disabled>
                -- Select your name from roster --
              </option>
              {roster.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.totalBookedHours}h / {m.targetHours}h)
                </option>
              ))}
              <option value="__new__">+ New rep not on roster</option>
            </select>

            <button
              type="button"
              onClick={() => setShowNewUserDialog(true)}
              className="text-xs text-[#0063a3] hover:text-[#004f83] font-semibold px-2.5 py-1.5 rounded bg-white border border-[#d8dce0] hover:border-[#0063a3] transition-colors flex items-center space-x-1 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3 h-3" />
              <span>Add Name</span>
            </button>
          </div>

          {/* User target progress */}
          {currentIdentity ? (
            <div className="flex items-center space-x-3 text-xs bg-white px-3 py-1.5 rounded border border-[#d8dce0] shadow-xs">
              <div className="flex items-center space-x-1.5">
                <span className="text-[#46535e]">Target:</span>
                <span className="font-mono font-semibold text-[#252a2e]">
                  {currentIdentity.totalBookedHours}h / {currentIdentity.targetHours}h
                </span>
              </div>
              <div className="w-20 bg-[#e7eaef] rounded-full h-2 overflow-hidden border border-[#d8dce0]">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    progressPercent >= 100
                      ? 'bg-[#00823b]'
                      : progressPercent >= 50
                        ? 'bg-[#0063a3]'
                        : 'bg-[#fbad26]'
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span
                className={cn(
                  'font-mono text-[11px] font-semibold',
                  progressPercent >= 100 ? 'text-[#00823b]' : 'text-[#46535e]'
                )}
              >
                {progressPercent}%
              </span>
            </div>
          ) : (
            <div className="text-xs text-[#8a5800] bg-[#fef8e8] border border-[#f7c970] px-2.5 py-1 rounded flex items-center space-x-1.5 font-medium">
              <span>Select or enter your name above to claim shifts</span>
            </div>
          )}
        </div>
      </div>

      {/* New User Modal Dialog */}
      {showNewUserDialog && (
        <div className="fixed inset-0 z-50 bg-[#252a2e]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#d8dce0] rounded max-w-md w-full p-6 shadow-modus-3 space-y-4">
            <div className="flex items-center justify-between border-b border-[#d8dce0] pb-3">
              <div className="flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-[#0063a3]" />
                <h3 className="font-bold text-[#252a2e] text-base">Join Expo Staffing Roster</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewUserDialog(false)}
                className="text-[#7c878e] hover:text-[#252a2e] text-xs px-2 py-1 rounded hover:bg-[#f1f3f6]"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-[#46535e]">
              Enter your name and work email. No password needed &bull; you will be able to claim and
              manage expo staffing shifts immediately.
            </p>

            <form onSubmit={handleCreateNewRep} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#252a2e] mb-1">
                  Full Name <span className="text-[#da3832]">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Alex Johnson"
                  className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-2 text-sm text-[#252a2e] placeholder:text-[#7c878e] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252a2e] mb-1">
                  Work Email (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g., alex@company.com"
                  className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-2 text-sm text-[#252a2e] placeholder:text-[#7c878e] focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2 border-t border-[#d8dce0]">
                <button
                  type="button"
                  onClick={() => setShowNewUserDialog(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#46535e] hover:text-[#252a2e] rounded bg-white hover:bg-[#f1f3f6] border border-[#d8dce0]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white rounded bg-[#0063a3] hover:bg-[#005084] shadow-xs cursor-pointer"
                >
                  Join &amp; Claim Shifts
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
