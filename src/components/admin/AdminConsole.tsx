import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import { useBoothDutyStore } from '@/store';
import { ShiftMatrix } from '../grid/ShiftMatrix';
import { cn } from '@/lib/utils';
import type { StaffMember } from '@/types';

interface AdminConsoleProps {
  adminKey: string;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ adminKey }) => {
  const {
    config,
    slots,
    roster,
    metrics,
    session,
    addBooking,
    removeBooking,
    addStaffMember,
    updateConfig,
  } = useBoothDutyStore();

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [quickAssignSlotId, setQuickAssignSlotId] = useState<string | null>(null);

  if (!config) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Event Not Found</h2>
        <p className="text-sm text-slate-400">
          No event matching admin key. Create a new event schedule or check your URL.
        </p>
        <a
          href="#/"
          className="inline-block px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold"
        >
          Create New Event
        </a>
      </div>
    );
  }

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    addStaffMember({
      eventId: config.id,
      name: newStaffName.trim(),
      email:
        newStaffEmail.trim() ||
        `${newStaffName.trim().toLowerCase().replace(/\s+/g, '.')}@booth.team`,
      targetHours: config.targetHoursPerStaff,
      isConfirmed: true,
    });
    setNewStaffName('');
    setNewStaffEmail('');
    setShowAddStaffModal(false);
  };

  const handleClaim = (slotId: string) => {
    // If admin has an active identity, book them, or open quick assign picker
    if (session.currentIdentity) {
      addBooking(slotId, session.currentIdentity);
    } else {
      setQuickAssignSlotId(slotId);
    }
  };

  const handleAdminRemove = (slotId: string, staffId: string) => {
    removeBooking(slotId, staffId);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Coverage & Metrics Command Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* Coverage Percentage */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Coverage Level</div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span
              className={cn(
                'text-3xl font-bold tracking-tight font-mono',
                metrics.overallCoveragePercent >= 80
                  ? 'text-emerald-400'
                  : metrics.overallCoveragePercent >= 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
              )}
            >
              {metrics.overallCoveragePercent}%
            </span>
            <span className="text-xs text-slate-500">of capacity filled</span>
          </div>
          <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                metrics.overallCoveragePercent >= 80
                  ? 'bg-emerald-500'
                  : metrics.overallCoveragePercent >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              )}
              style={{ width: `${metrics.overallCoveragePercent}%` }}
            />
          </div>
        </div>

        {/* Staffing Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Staffing Status</div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-bold tracking-tight font-mono text-white">
              {metrics.understaffedSlotCount}
            </span>
            <span className="text-xs text-amber-400 font-medium">slots need reps</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono">
            {metrics.totalSlots - metrics.understaffedSlotCount} of {metrics.totalSlots} fully staffed
          </div>
        </div>

        {/* Booked Hours */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium">Committed Hours</div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-bold tracking-tight font-mono text-violet-400">
              {metrics.totalBookedHours}h
            </span>
            <span className="text-xs text-slate-500 font-mono">
              / {metrics.totalCapacityHours}h needed
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono">
            {Math.max(0, Math.round((metrics.totalCapacityHours - metrics.totalBookedHours) * 10) / 10)}h remaining
          </div>
        </div>

        {/* Team Roster size */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs text-slate-400 font-medium flex items-center justify-between">
            <span>Roster Active</span>
            <button
              type="button"
              onClick={() => setShowAddStaffModal(true)}
              className="text-violet-400 hover:text-violet-300 font-medium flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-bold tracking-tight font-mono text-white">
              {roster.length}
            </span>
            <span className="text-xs text-slate-500">booth reps</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 font-mono">
            Target: {config.targetHoursPerStaff}h per rep
          </div>
        </div>
      </div>

      {/* Main Command Console: Roster Quick Strip & Shift Matrix */}
      <div className="space-y-6">
        {/* Roster Strip */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
              <Users className="w-4 h-4 text-violet-400" />
              <span>Team Roster Commitment</span>
              <span className="text-slate-500 font-mono">({roster.length} reps)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddStaffModal(true)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Rep</span>
            </button>
          </div>

          {roster.length === 0 ? (
            <div className="py-4 text-center text-xs text-slate-500">
              No reps in roster yet. Share the public link or add names manually.
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {roster.map((member) => {
                const targetMet = member.totalBookedHours >= member.targetHours;
                return (
                  <div
                    key={member.id}
                    className={cn(
                      'shrink-0 px-3 py-2 rounded-xl text-xs flex items-center space-x-2 border transition-all',
                      targetMet
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    )}
                  >
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                        targetMet
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300'
                      )}
                    >
                      {member.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-100 truncate max-w-[120px]">
                        {member.name}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {member.totalBookedHours}h / {member.targetHours}h
                      </div>
                    </div>
                    {targetMet && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Master Shift Matrix */}
        <ShiftMatrix
          slots={slots}
          currentIdentity={session.currentIdentity}
          isAdmin={true}
          onClaim={handleClaim}
          onLeave={(slotId, staffId) => removeBooking(slotId, staffId)}
          onAdminRemove={handleAdminRemove}
          onRequestIdentity={() => setShowAddStaffModal(true)}
        />
      </div>

      {/* Add Staff Modal */}
      {showAddStaffModal && (
        <div className="fixed inset-0 z-50 bg-[#252a2e]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#d8dce0] rounded max-w-md w-full p-6 shadow-modus-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-[#0063a3]" />
                <h3 className="font-bold text-[#252a2e] text-base">Add Staff Representative</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStaffModal(false)}
                className="text-[#7c878e] hover:text-[#252a2e] text-xs px-2.5 py-1 rounded bg-[#f1f3f6] hover:bg-[#e7eaef] font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleAddStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#252a2e] mb-1">
                  Full Name <span className="text-[#da3832]">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  placeholder="e.g., Jane Doe"
                  className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-2 text-sm text-[#252a2e] placeholder:text-[#7c878e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252a2e] mb-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={newStaffEmail}
                  onChange={(e) => setNewStaffEmail(e.target.value)}
                  placeholder="e.g., jane@company.com"
                  className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-2 text-sm text-[#252a2e] placeholder:text-[#7c878e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddStaffModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-[#46535e] hover:text-[#252a2e] rounded bg-white hover:bg-[#f1f3f6] border border-[#d8dce0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white rounded bg-[#0063a3] hover:bg-[#005084] shadow-xs cursor-pointer"
                >
                  Add to Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Assign Dialog */}
      {quickAssignSlotId && (
        <div className="fixed inset-0 z-50 bg-[#252a2e]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#d8dce0] rounded max-w-md w-full p-6 shadow-modus-4 space-y-4">
            <h3 className="font-bold text-[#252a2e] text-base">Assign Rep to Shift</h3>
            <p className="text-xs text-[#46535e]">
              Select a team member to assign to this open time slot:
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {roster.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    addBooking(quickAssignSlotId, m);
                    setQuickAssignSlotId(null);
                  }}
                  className="w-full px-3 py-2 rounded text-xs text-left bg-[#f8f9fa] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#0063a3] text-[#252a2e] flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-[11px] font-mono text-[#7c878e]">
                    {m.totalBookedHours}h / {m.targetHours}h
                  </span>
                </button>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setQuickAssignSlotId(null)}
                className="px-3.5 py-2 text-xs font-semibold text-[#46535e] hover:text-[#252a2e] rounded bg-white hover:bg-[#f1f3f6] border border-[#d8dce0] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
