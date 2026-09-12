import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Layers,
  Plus,
  RefreshCw,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useEventStore } from '@/store/useEventStore';
import { CoverageStats } from './CoverageStats';
import { GoogleCalendarConnect } from './GoogleCalendarConnect';
import { RosterLedger } from './RosterLedger';
import { ZeroHourDrawer } from './ZeroHourDrawer';
import { AdminShareModal } from './AdminShareModal';
import { ShiftMatrix } from '../grid/ShiftMatrix';
import { cn, formatTime12h } from '@/lib/utils';
import type { StaffMember, TimeSlot } from '@/types';

interface AdminDashboardProps {
  adminKey: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminKey }) => {
  const {
    currentEvent,
    slots,
    roster,
    metrics,
    isLoading,
    error,
    loadEventByKey,
    addRosterMember,
    removeRosterMember,
    updateSlotCapacity,
    updateDefaultSlotCapacity,
    adminAssignStaffToSlot,
    adminRemoveStaffFromSlot,
    clearError,
    resetToDemo,
  } = useEventStore();

  const [selectedSlotForAssign, setSelectedSlotForAssign] = useState<TimeSlot | null>(null);
  const [showZeroHoursDrawer, setShowZeroHoursDrawer] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'matrix' | 'roster'>('matrix');

  useEffect(() => {
    loadEventByKey(adminKey);
  }, [adminKey, loadEventByKey]);

  // Keep selected slot updated with state changes
  const activeSlot = selectedSlotForAssign
    ? slots.find((s) => s.id === selectedSlotForAssign.id) || null
    : null;

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-20 px-4 flex flex-col items-center justify-center space-y-4 text-center">
        <div className="w-10 h-10 border-4 border-[#b9dcf0] border-t-[#0063a3] rounded-full animate-spin" />
        <p className="text-sm text-[#46535e] font-medium">Loading Expo Staffing Admin...</p>
      </div>
    );
  }

  if (!currentEvent) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded bg-[#fef8e8] border border-[#f7c970] text-[#fbad26] flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#252a2e]">Event Schedule Not Found</h2>
        <p className="text-sm text-[#46535e] leading-relaxed">
          No schedule was found for admin key <code className="text-[#252a2e] bg-[#e7eaef] px-1.5 py-0.5 rounded">{adminKey}</code>.
          You can create a new schedule or load the interactive SaaS Disrupt demo.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={resetToDemo}
            className="focus-ring px-4 py-2 bg-[#0063a3] hover:bg-[#005084] text-white rounded text-xs font-semibold shadow-xs transition-colors"
          >
            Load Demo Event
          </button>
          <a
            href="#/"
            className="focus-ring px-4 py-2 bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] rounded text-xs font-semibold transition-colors"
          >
            Create New Event
          </a>
        </div>
      </div>
    );
  }

  const zeroHoursMembers = roster.filter((m) => m.totalBookedHours === 0);

  const handleSlotClick = (slotId: string) => {
    const found = slots.find((s) => s.id === slotId);
    if (found) {
      setSelectedSlotForAssign(found);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Global Error Banner */}
      {error && (
        <div className="bg-[#fdf2f2] border border-[#f5b5b3] text-[#da3832] px-4 py-3 rounded text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-[#da3832] shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="focus-ring rounded text-[#da3832] hover:text-[#b0221d] p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Google Calendar auto-invite connection */}
      <GoogleCalendarConnect config={currentEvent} />

      {/* Header Stats Panel */}
      <CoverageStats
        config={currentEvent}
        metrics={metrics}
        roster={roster}
        zeroHoursCount={zeroHoursMembers.length}
        onOpenZeroHoursDrawer={() => setShowZeroHoursDrawer(true)}
        onOpenShareModal={() => setShowShareModal(true)}
        onUpdateDefaultCapacity={updateDefaultSlotCapacity}
      />

      {/* View Switcher / Sub-navigation */}
      <div className="flex items-center justify-between border-b border-[#d8dce0] pb-3 flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('matrix')}
            className={cn(
              'focus-ring px-4 py-2 rounded text-xs font-semibold flex items-center space-x-2 transition-colors',
              activeTab === 'matrix'
                ? 'bg-[#0063a3] text-white shadow-xs'
                : 'bg-white text-[#46535e] hover:text-[#252a2e] hover:bg-[#f1f3f6] border border-[#d8dce0]'
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Shifts</span>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-mono',
              activeTab === 'matrix' ? 'bg-[#005084] text-white' : 'bg-[#e7eaef] text-[#46535e]'
            )}>
              {slots.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={cn(
              'focus-ring px-4 py-2 rounded text-xs font-semibold flex items-center space-x-2 transition-colors',
              activeTab === 'roster'
                ? 'bg-[#0063a3] text-white shadow-xs'
                : 'bg-white text-[#46535e] hover:text-[#252a2e] hover:bg-[#f1f3f6] border border-[#d8dce0]'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Staffing</span>
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded font-mono',
              activeTab === 'roster' ? 'bg-[#005084] text-white' : 'bg-[#e7eaef] text-[#46535e]'
            )}>
              {roster.length}
            </span>
          </button>
        </div>

        {/* Action button: Staff picker shortcut */}
        <a
          href={`#/event/${currentEvent.publicKey}`}
          className="focus-ring rounded inline-flex items-center space-x-1.5 text-xs text-[#0063a3] hover:text-[#005084] font-semibold transition-colors"
        >
          <span>Open Staff</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Tab 1: Interactive Matrix View */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-[#46535e]">
            <p>
              Click any shift tile to manually assign staff, remove representatives, or alter slot capacity.
            </p>
            <div className="flex items-center space-x-3 text-[11px] font-mono">
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00823b] inline-block" />
                <span>Full</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fbad26] inline-block" />
                <span>Partial</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-2.5 h-2.5 rounded-full bg-[#7c878e] inline-block" />
                <span>Empty</span>
              </span>
            </div>
          </div>

          <ShiftMatrix
            slots={slots}
            config={currentEvent}
            currentIdentity={null}
            targetHours={metrics.dynamicTargetHours}
            isAdmin={true}
            onSlotClick={handleSlotClick}
            onAdminRemove={(slotId, staffId) => adminRemoveStaffFromSlot(slotId, staffId)}
          />
        </div>
      )}

      {/* Tab 2: Staffing */}
      {activeTab === 'roster' && (
        <RosterLedger
          roster={roster}
          targetHours={metrics.dynamicTargetHours}
          onAddMember={addRosterMember}
          onRemoveMember={removeRosterMember}
        />
      )}

      {/* Admin Slot Quick-Assign & Capacity Modal */}
      {activeSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-[#d8dce0] rounded max-w-md w-full p-5 space-y-4 shadow-modus-3">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-[#d8dce0] pb-3">
              <div>
                <span className="text-[11px] font-bold text-[#0063a3] uppercase tracking-wider">
                  Shift Slot Inspection
                </span>
                <h3 className="text-base font-bold text-[#252a2e]">
                  {formatTime12h(activeSlot.startTime)} &ndash; {formatTime12h(activeSlot.endTime)}
                </h3>
                <p className="text-xs text-[#7c878e]">{activeSlot.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlotForAssign(null)}
                className="focus-ring p-1 text-[#7c878e] hover:text-[#252a2e] rounded hover:bg-[#f1f3f6]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Capacity Stepper */}
            <div className="flex items-center justify-between bg-[#f8f9fa] p-3 rounded border border-[#d8dce0]">
              <div>
                <div className="text-xs font-semibold text-[#252a2e]">Staff Capacity</div>
                <div className="text-[11px] text-[#7c878e]">Target staffing level for this specific shift</div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={activeSlot.capacity <= 1}
                  onClick={() => updateSlotCapacity(activeSlot.id, activeSlot.capacity - 1)}
                  className="focus-ring w-7 h-7 rounded bg-white hover:bg-[#f1f3f6] border border-[#d8dce0] disabled:opacity-40 text-[#252a2e] font-bold flex items-center justify-center cursor-pointer"
                >
                  -
                </button>
                <span className="font-mono font-bold text-[#252a2e] text-sm w-5 text-center">
                  {activeSlot.capacity}
                </span>
                <button
                  type="button"
                  disabled={activeSlot.capacity >= 8}
                  onClick={() => updateSlotCapacity(activeSlot.id, activeSlot.capacity + 1)}
                  className="focus-ring w-7 h-7 rounded bg-white hover:bg-[#f1f3f6] border border-[#d8dce0] disabled:opacity-40 text-[#252a2e] font-bold flex items-center justify-center cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* Currently Assigned Staff */}
            <div>
              <div className="text-xs font-semibold text-[#46535e] uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Assigned Staff ({activeSlot.bookings.length}/{activeSlot.capacity})</span>
                {activeSlot.bookings.length >= activeSlot.capacity && (
                  <span className="text-[11px] text-[#00823b] font-semibold">Capacity Reached</span>
                )}
              </div>
              {activeSlot.bookings.length === 0 ? (
                <div className="p-3 bg-[#f8f9fa] rounded border border-dashed border-[#d8dce0] text-center text-xs text-[#7c878e]">
                  No staff members assigned to this shift yet.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {activeSlot.bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center justify-between p-2 bg-[#f8f9fa] rounded border border-[#d8dce0]"
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-[#e5f2f8] text-[#0063a3] font-bold text-xs flex items-center justify-center">
                          {booking.staffName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-[#252a2e]">{booking.staffName}</div>
                          <div className="text-[10px] text-[#7c878e] font-mono">{booking.staffEmail}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => adminRemoveStaffFromSlot(activeSlot.id, booking.staffId)}
                        className="focus-ring px-2 py-1 text-[11px] text-[#da3832] hover:bg-[#fdf2f2] rounded transition-colors font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Assignment Options */}
            {activeSlot.bookings.length < activeSlot.capacity && (
              <div>
                <div className="text-xs font-semibold text-[#46535e] uppercase tracking-wider mb-2">
                  Assign Available Roster Member:
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {roster
                    .filter((m) => !activeSlot.bookings.some((b) => b.staffId === m.id))
                    .map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => adminAssignStaffToSlot(activeSlot.id, member)}
                        className="focus-ring w-full flex items-center justify-between p-2 rounded bg-white hover:bg-[#e5f2f8] hover:border-[#0063a3] border border-[#d8dce0] text-left transition-colors group cursor-pointer"
                      >
                        <div>
                          <div className="text-xs font-semibold text-[#252a2e] group-hover:text-[#0063a3]">
                            {member.name}
                          </div>
                          <div className="text-[10px] text-[#7c878e]">
                            {member.totalBookedHours}h booked / {metrics.dynamicTargetHours}h target
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-[#0063a3] group-hover:translate-x-0.5 transition-transform flex items-center">
                          Assign <ChevronRight className="w-3 h-3" />
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-[#d8dce0] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSlotForAssign(null)}
                className="focus-ring px-4 py-2 bg-[#0063a3] hover:bg-[#005084] text-white text-xs font-semibold rounded shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zero-Hours Accountability Drawer (SCR-03) */}
      <ZeroHourDrawer
        isOpen={showZeroHoursDrawer}
        onClose={() => setShowZeroHoursDrawer(false)}
        config={currentEvent}
        roster={roster}
        targetHours={metrics.dynamicTargetHours}
        onNavigateToRoster={() => setActiveTab('roster')}
      />

      {/* Admin Capability Share & QR Modal (SCR-04) */}
      <AdminShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        config={currentEvent}
      />
    </div>
  );
};
