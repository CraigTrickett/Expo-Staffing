import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Plus,
  Sparkles,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type { StaffMember } from '@/types';
import { useModalA11y } from '@/lib/hooks';
import { cn } from '@/lib/utils';

interface IdentityBarProps {
  roster: StaffMember[];
  currentStaff: StaffMember | null;
  targetHours: number;
  onSelectStaff: (staffId: string) => void;
  onAddNewStaff: (name: string, email?: string) => void;
}

export const IdentityBar: React.FC<IdentityBarProps> = ({
  roster,
  currentStaff,
  targetHours,
  onSelectStaff,
  onAddNewStaff,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const addModalRef = useModalA11y(showAddModal, () => setShowAddModal(false));
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    onAddNewStaff(newName.trim(), newEmail.trim() || undefined);
    setNewName('');
    setNewEmail('');
    setShowAddModal(false);
    setIsOpen(false);
  };

  const percentBooked = currentStaff
    ? Math.min(100, Math.round((currentStaff.totalBookedHours / Math.max(1, targetHours)) * 100))
    : 0;

  const isTargetMet = currentStaff && currentStaff.totalBookedHours >= targetHours;

  return (
    <>
      <div className="bg-white border-b border-[#d8dce0] sticky top-14 z-30 shadow-modus-1 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          {!currentStaff ? (
            /* Unclaimed state: Prominent prompt */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#e5f2f8] border border-[#b9dcf0] rounded p-3 sm:px-5">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded bg-[#0063a3] text-white flex items-center justify-center shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#252a2e] tracking-tight">
                    Who is claiming shifts?
                  </h2>
                  <p className="text-xs text-[#46535e]">
                    Select your name from the team roster or add yourself in 1 click.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="px-4 py-2 bg-white hover:bg-[#f1f3f6] border border-[#d8dce0] text-[#252a2e] rounded text-xs font-semibold flex items-center space-x-2 transition-colors shadow-xs cursor-pointer"
                  >
                    <span>Choose Your Name</span>
                    <ChevronDown className="w-3.5 h-3.5 text-[#7c878e]" />
                  </button>

                  {isOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-[#d8dce0] rounded shadow-modus-3 py-2 z-50 max-h-72 overflow-y-auto">
                      <div className="px-3 py-1.5 text-[10px] font-bold text-[#46535e] uppercase tracking-wider">
                        Expo Staffing Roster ({roster.length})
                      </div>
                      {roster.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            onSelectStaff(member.id);
                            setIsOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-[#252a2e] hover:bg-[#e5f2f8] hover:text-[#0063a3] flex items-center justify-between transition-colors cursor-pointer"
                        >
                          <div className="truncate pr-2">
                            <div className="font-semibold text-[#252a2e] truncate">{member.name}</div>
                            <div className="text-[10px] text-[#7c878e] font-mono truncate">{member.email}</div>
                          </div>
                          <span className="text-[11px] font-mono text-[#46535e] shrink-0">
                            {member.totalBookedHours}h / {targetHours}h
                          </span>
                        </button>
                      ))}
                      <div className="border-t border-[#d8dce0] my-1 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            setShowAddModal(true);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-[#0063a3] hover:bg-[#e5f2f8] font-semibold flex items-center space-x-2 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>I'm not on this list (+ Add My Name)</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-3.5 py-2 bg-[#0063a3] hover:bg-[#005084] text-white rounded text-xs font-semibold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add My Name</span>
                </button>
              </div>
            </div>
          ) : (
            /* Claimed state: "Scheduling as [Name] · [X] of [Target] hours booked" */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#f8f9fa] border border-[#d8dce0] rounded p-3 sm:px-4 shadow-xs">
              <div className="flex items-center space-x-3">
                <div className={cn(
                  'w-9 h-9 rounded flex items-center justify-center font-bold text-sm shrink-0 border',
                  isTargetMet
                    ? 'bg-[#e6f5ec] text-[#00823b] border-[#a3e0be]'
                    : 'bg-[#e5f2f8] text-[#0063a3] border-[#b9dcf0]'
                )}>
                  {currentStaff.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="text-xs text-[#46535e]">Scheduling as</span>
                    <span className="text-sm font-bold text-[#252a2e]">
                      {currentStaff.name}
                    </span>
                    <span className="text-xs text-[#7c878e] font-mono hidden md:inline">
                      ({currentStaff.email})
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs mt-0.5">
                    <span className="text-[#46535e]">
                      <strong className={cn('font-mono font-bold', isTargetMet ? 'text-[#00823b]' : 'text-[#0063a3]')}>
                        {currentStaff.totalBookedHours}
                      </strong>{' '}
                      of{' '}
                      <strong className="text-[#252a2e] font-mono">{targetHours}</strong> hours booked
                    </span>
                    {isTargetMet && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00823b] bg-[#e6f5ec] px-2 py-0.5 rounded border border-[#a3e0be]">
                        <CheckCircle2 className="w-3 h-3" /> Target Met!
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar and switch identity button */}
              <div className="flex items-center space-x-4 shrink-0">
                <div className="hidden sm:block w-32">
                  <div className="flex justify-between text-[11px] text-[#46535e] mb-1">
                    <span>Target Progress</span>
                    <span className="font-mono font-bold">{percentBooked}%</span>
                  </div>
                  <div className="w-full bg-[#e7eaef] h-2 rounded-full overflow-hidden border border-[#d8dce0]">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        isTargetMet ? 'bg-[#00823b]' : 'bg-[#0063a3]'
                      )}
                      style={{ width: `${percentBooked}%` }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(!isOpen)}
                  className="px-3 py-1.5 bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] rounded text-xs font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  Switch Identity
                </button>

                {isOpen && (
                  <div className="absolute right-4 top-16 w-64 bg-white border border-[#d8dce0] rounded shadow-modus-3 py-2 z-50 max-h-72 overflow-y-auto">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-[#46535e] uppercase tracking-wider">
                      Switch To Another Member
                    </div>
                    {roster.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          onSelectStaff(member.id);
                          setIsOpen(false);
                        }}
                        className={cn(
                          'w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer',
                          member.id === currentStaff.id
                            ? 'bg-[#e5f2f8] text-[#0063a3] font-bold'
                            : 'text-[#252a2e] hover:bg-[#f8f9fa]'
                        )}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate font-medium">{member.name}</div>
                          <div className="text-[10px] text-[#7c878e] font-mono truncate">{member.email}</div>
                        </div>
                        <span className="text-[11px] font-mono text-[#46535e]">
                          {member.totalBookedHours}h
                        </span>
                      </button>
                    ))}
                    <div className="border-t border-[#d8dce0] my-1 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setShowAddModal(true);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-[#0063a3] hover:bg-[#e5f2f8] font-semibold flex items-center space-x-2 cursor-pointer"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>+ Add New Team Member</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add My Name Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            ref={addModalRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            className="bg-white border border-[#d8dce0] rounded max-w-md w-full p-5 space-y-4 shadow-modus-4 focus:outline-hidden"
          >
            <div className="flex items-start justify-between border-b border-[#d8dce0] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#252a2e]">Join Expo Staffing Roster</h3>
                <p className="text-xs text-[#46535e]">
                  Enter your information to sign up for exhibition shifts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-[#7c878e] hover:text-[#252a2e] rounded hover:bg-[#f1f3f6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#252a2e] mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={100}
                  placeholder="e.g. Jordan Miller"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-[#d8dce0] rounded px-3 py-2 text-xs text-[#252a2e] placeholder:text-[#7c878e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 focus:border-[#0063a3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#252a2e] mb-1">
                  Work Email (for calendar sync)
                </label>
                <input
                  type="email"
                  maxLength={254}
                  placeholder="e.g. jordan@company.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-white border border-[#d8dce0] rounded px-3 py-2 text-xs text-[#252a2e] placeholder:text-[#7c878e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 focus:border-[#0063a3]"
                />
              </div>

              <div className="pt-3 border-t border-[#d8dce0] flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] rounded text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim()}
                  className="px-4 py-2 bg-[#0063a3] hover:bg-[#005084] disabled:opacity-50 text-white rounded text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Save & Start Scheduling
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
