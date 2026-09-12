import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import type { StaffMember } from '@/types';
import { cn } from '@/lib/utils';

interface RosterLedgerProps {
  roster: StaffMember[];
  targetHours: number;
  onAddMember: (name: string, email?: string) => void;
  onRemoveMember: (staffId: string) => void;
  filterZeroHoursOnly?: boolean;
}

export const RosterLedger: React.FC<RosterLedgerProps> = ({
  roster,
  targetHours,
  onAddMember,
  onRemoveMember,
  filterZeroHoursOnly = false,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'zero' | 'met'>(
    filterZeroHoursOnly ? 'zero' : 'all'
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    onAddMember(nameInput.trim(), emailInput.trim() || undefined);
    setNameInput('');
    setEmailInput('');
  };

  const filteredRoster = roster.filter((member) => {
    // Search match
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      member.name.toLowerCase().includes(q) ||
      member.email.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (filterMode === 'zero') {
      return member.totalBookedHours === 0;
    }
    if (filterMode === 'met') {
      return member.totalBookedHours >= targetHours;
    }
    return true;
  });

  const zeroCount = roster.filter((m) => m.totalBookedHours === 0).length;
  const metCount = roster.filter((m) => m.totalBookedHours >= targetHours).length;

  return (
    <div className="bg-white border border-[#d8dce0] rounded shadow-modus-1 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[#d8dce0] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#f8f9fa]">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[#0063a3]" />
            <h2 className="text-base font-bold text-[#252a2e] tracking-tight">
              Roster Audit Ledger
            </h2>
            <span className="text-xs bg-[#e7eaef] text-[#252a2e] font-mono px-2 py-0.5 rounded font-semibold">
              {roster.length} members
            </span>
          </div>
          <p className="text-xs text-[#46535e] mt-1">
            Track booked hours against the target of {targetHours}h per team member.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#7c878e] absolute left-2.5 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white border border-[#d8dce0] text-xs text-[#252a2e] pl-8 pr-3 py-1.5 rounded focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 focus:border-[#0063a3] w-36 sm:w-44"
            />
          </div>

          <div className="flex bg-[#e7eaef] p-0.5 rounded border border-[#d8dce0] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={cn(
                'px-2.5 py-1 rounded transition-colors cursor-pointer',
                filterMode === 'all'
                  ? 'bg-[#0063a3] text-white shadow-xs'
                  : 'text-[#46535e] hover:text-[#252a2e]'
              )}
            >
              All ({roster.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('zero')}
              className={cn(
                'px-2.5 py-1 rounded transition-colors flex items-center space-x-1 cursor-pointer',
                filterMode === 'zero'
                  ? 'bg-[#8a5800] text-white shadow-xs'
                  : 'text-[#46535e] hover:text-[#8a5800]'
              )}
            >
              <span>0 Hours ({zeroCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('met')}
              className={cn(
                'px-2.5 py-1 rounded transition-colors cursor-pointer',
                filterMode === 'met'
                  ? 'bg-[#00823b] text-white shadow-xs'
                  : 'text-[#46535e] hover:text-[#00823b]'
              )}
            >
              Goal Met ({metCount})
            </button>
          </div>
        </div>
      </div>

      {/* Rapid Inline Add Form */}
      <form
        onSubmit={handleAddSubmit}
        className="p-4 bg-[#f8f9fa] border-b border-[#d8dce0] flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        <div className="flex items-center space-x-1.5 text-xs text-[#46535e] shrink-0 font-semibold">
          <UserPlus className="w-3.5 h-3.5 text-[#0063a3]" />
          <span>Add Staff:</span>
        </div>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            placeholder="Full Name (e.g. Maya Lin)"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            className="w-full bg-white border border-[#d8dce0] text-xs text-[#252a2e] px-3 py-2 rounded focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 focus:border-[#0063a3] placeholder:text-[#7c878e]"
          />
        </div>
        <div className="flex-1 min-w-0">
          <input
            type="email"
            placeholder="Email (optional, e.g. maya@company.com)"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="w-full bg-white border border-[#d8dce0] text-xs text-[#252a2e] px-3 py-2 rounded focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 focus:border-[#0063a3] placeholder:text-[#7c878e]"
          />
        </div>
        <button
          type="submit"
          disabled={!nameInput.trim()}
          className="px-4 py-2 bg-[#0063a3] hover:bg-[#005084] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs font-semibold shrink-0 transition-colors flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add to Roster</span>
        </button>
      </form>

      {/* Ledger Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f1f3f6] text-[#46535e] font-semibold border-b border-[#d8dce0] uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Staff Member</th>
              <th className="py-3 px-4">Email</th>
              <th className="py-3 px-4">Commitment</th>
              <th className="py-3 px-4">Progress</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d8dce0]">
            {filteredRoster.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[#7c878e]">
                  No roster members match current filter.
                </td>
              </tr>
            ) : (
              filteredRoster.map((member) => {
                const percent = Math.min(
                  100,
                  Math.round((member.totalBookedHours / Math.max(1, targetHours)) * 100)
                );
                const isZero = member.totalBookedHours === 0;
                const isMet = member.totalBookedHours >= targetHours;

                return (
                  <tr
                    key={member.id}
                    className="hover:bg-[#f8f9fa] transition-colors group"
                  >
                    {/* Name & Badge */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div
                          className={cn(
                            'w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] shrink-0',
                            isMet
                              ? 'bg-[#e6f5ec] text-[#00823b] border border-[#a3e0be]'
                              : isZero
                                ? 'bg-[#fef8e8] text-[#8a5800] border border-[#f7c970]'
                                : 'bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0]'
                          )}
                        >
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-[#252a2e]">
                            {member.name}
                          </div>
                          {isZero && (
                            <span className="inline-flex items-center text-[10px] text-[#8a5800] font-semibold">
                              0 hours booked
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td className="py-3 px-4 text-[#46535e] font-mono text-[11px]">
                      {member.email}
                    </td>

                    {/* Commitment Stats */}
                    <td className="py-3 px-4">
                      <div className="flex items-baseline space-x-1 font-mono">
                        <span
                          className={cn(
                            'font-bold text-sm',
                            isMet
                              ? 'text-[#00823b]'
                              : isZero
                                ? 'text-[#8a5800]'
                                : 'text-[#252a2e]'
                          )}
                        >
                          {member.totalBookedHours}h
                        </span>
                        <span className="text-[#7c878e] text-[11px]">
                          / {targetHours}h
                        </span>
                      </div>
                    </td>

                    {/* Progress Bar */}
                    <td className="py-3 px-4 w-48">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-[#46535e]">
                          <span className="font-mono font-semibold">{percent}%</span>
                          {isMet ? (
                            <span className="text-[#00823b] font-semibold flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Met
                            </span>
                          ) : (
                            <span>{Math.max(0, targetHours - member.totalBookedHours)}h left</span>
                          )}
                        </div>
                        <div className="w-full bg-[#e7eaef] h-2 rounded-full overflow-hidden border border-[#d8dce0]">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-300',
                              isMet
                                ? 'bg-[#00823b]'
                                : isZero
                                  ? 'bg-[#fbad26]'
                                  : 'bg-[#0063a3]'
                            )}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      {confirmDeleteId === member.id ? (
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => {
                              onRemoveMember(member.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 bg-[#da3832] hover:bg-[#b0221d] text-white rounded text-[11px] font-semibold cursor-pointer"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] rounded text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(member.id)}
                          className="p-1.5 text-[#7c878e] hover:text-[#da3832] hover:bg-[#fdf2f2] rounded transition-colors cursor-pointer"
                          title={`Remove ${member.name} from roster`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
