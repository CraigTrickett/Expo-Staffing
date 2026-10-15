import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowLeft,
  Search,
  Plus,
  Users,
  Mail,
  Phone,
  Briefcase,
  Edit2,
  Trash2,
  Check,
  Filter,
} from 'lucide-react';
import type { EventConfig, KeyStakeholder, StaffMember } from '@/types';
import {
  getStakeholders,
  addStakeholder,
  updateStakeholder,
  deleteStakeholder,
  addSampleStakeholders,
  INVOLVED_AREAS_OPTIONS,
  TEAMS_OPTIONS,
} from '@/lib/stakeholders';
import { usePageFocus } from '@/lib/hooks';
import { usesOfStakeholder } from '@/lib/references';
import { toast } from '@/components/common/Toast';
import { useEventStore } from '@/store/useEventStore';

interface KeyStakeholdersPageProps {
  event: EventConfig;
  onBack: () => void;
}

export const KeyStakeholdersPage: React.FC<KeyStakeholdersPageProps> = ({
  event,
  onBack,
  }) => {
  const modalRef = usePageFocus();
  const { roster, addRosterMember } = useEventStore();
  const [stakeholders, setStakeholders] = useState<KeyStakeholder[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState('all');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [team, setTeam] = useState('Product Marketing');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [involvedWith, setInvolvedWith] = useState<string[]>(['Keynote / General Session']);
  const [alsoAddToBoothRoster, setAlsoAddToBoothRoster] = useState(false);

  useEffect(() => {
    const list = getStakeholders(event.id, roster);
    setStakeholders(list);
  }, [event.id, roster]);

  const teams = useMemo(() => {
    const set = new Set<string>();
    stakeholders.forEach((s) => s.team && set.add(s.team));
    TEAMS_OPTIONS.forEach((t) => set.add(t));
    return ['all', ...Array.from(set)];
  }, [stakeholders]);

  const filteredStakeholders = useMemo(() => {
    return stakeholders.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        s.firstName.toLowerCase().includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.team.toLowerCase().includes(q) ||
        s.involvedWith.some((area) => area.toLowerCase().includes(q));

      const matchTeam = selectedTeamFilter === 'all' || s.team === selectedTeamFilter;
      const matchArea = selectedAreaFilter === 'all' || s.involvedWith.includes(selectedAreaFilter);

      return matchSearch && matchTeam && matchArea;
    });
  }, [stakeholders, searchQuery, selectedTeamFilter, selectedAreaFilter]);

  const resetForm = () => {
    setEditingId(null);
    setFirstName('');
    setLastName('');
    setEmail('');
    setTeam('Product Marketing');
    setPhone('');
    setNotes('');
    setInvolvedWith(['Keynote / General Session']);
    setAlsoAddToBoothRoster(false);
    setIsFormOpen(false);
  };

  const handleStartEdit = (s: KeyStakeholder) => {
    setEditingId(s.id);
    setFirstName(s.firstName);
    setLastName(s.lastName);
    setEmail(s.email);
    setTeam(s.team || 'General');
    setPhone(s.phone || '');
    setNotes(s.notes || '');
    setInvolvedWith(s.involvedWith || []);
    setAlsoAddToBoothRoster(false);
    setIsFormOpen(true);
  };

  const toggleInvolvedArea = (area: string) => {
    setInvolvedWith((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error('First name and surname are required.', 'Missing fields');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('A valid email is required.', 'Missing fields');
      return;
    }

    if (editingId) {
      const updated = updateStakeholder(event.id, editingId, {
        firstName,
        lastName,
        email,
        team,
        phone,
        notes,
        involvedWith,
      });
      if (updated) {
        setStakeholders((prev) => prev.map((s) => (s.id === editingId ? updated : s)));
        toast.success(`Updated ${firstName} ${lastName}.`);
      }
    } else {
      const created = addStakeholder(event.id, {
        firstName,
        lastName,
        email,
        team,
        phone,
        notes,
        involvedWith,
      });
      setStakeholders((prev) => [created, ...prev]);

      if (alsoAddToBoothRoster || involvedWith.includes('Expo Booths')) {
        addRosterMember(`${firstName.trim()} ${lastName.trim()}`, email.trim());
      }
      toast.success(`Added ${firstName} ${lastName} to stakeholders.`);
    }

    resetForm();
  };

  const handleDelete = (id: string, name: string) => {
    const uses = usesOfStakeholder(event.id, id);
    const warning =
      uses.length > 0
        ? `\n\n${name} is used in:\n${uses.map((u) => `  \u2022 ${u}`).join('\n')}\n\nThey will still appear there by name, marked as removed.`
        : '';
    if (!window.confirm(`Remove ${name} from Key Stakeholders?${warning}`)) return;
    deleteStakeholder(event.id, id);
    setStakeholders((prev) => prev.filter((s) => s.id !== id));
    toast.info(`Removed ${name}.`);
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section ref={modalRef} tabIndex={-1} aria-labelledby="stakeholders-modal-title" className="flex flex-col rounded border border-[#d8dce0] bg-white shadow-xs focus:outline-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[#d8dce0] bg-[#f8f9fa]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <button
                type="button"
                onClick={onBack}
                className="focus-ring p-2 rounded text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] border border-[#d8dce0] hover:border-[#b9dcf0] bg-white transition-colors cursor-pointer shrink-0 mt-0.5"
                title="Back to menu"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-xs text-[#46535e]">{event.title}</p>
                <h1 id="stakeholders-modal-title" className="text-lg font-bold text-[#252a2e] mt-0.5 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#0063a3]" />
                  <span>Key Stakeholders</span>
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setIsFormOpen(true);
                }}
                className="focus-ring px-3.5 py-1.5 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add stakeholder</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-4 pt-3 border-t border-[#e5e9ec] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-[#5b6770] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, team, or area..."
                className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded pl-8 pr-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25"
              />
            </div>

            {/* Dropdown Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#5b6770] text-[11px] font-semibold">Team:</span>
                <select aria-label="Filter by team"
                  value={selectedTeamFilter}
                  onChange={(e) => setSelectedTeamFilter(e.target.value)}
                  className="bg-white border border-[#d8dce0] rounded px-2.5 py-1 text-xs text-[#252a2e] focus:outline-hidden focus:border-[#0063a3]"
                >
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t === 'all' ? 'All Teams' : t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-[#5b6770] text-[11px] font-semibold">Involved with:</span>
                <select aria-label="Filter by area"
                  value={selectedAreaFilter}
                  onChange={(e) => setSelectedAreaFilter(e.target.value)}
                  className="bg-white border border-[#d8dce0] rounded px-2.5 py-1 text-xs text-[#252a2e] focus:outline-hidden focus:border-[#0063a3]"
                >
                  <option value="all">All Areas</option>
                  {INVOLVED_AREAS_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Add / Edit Form Drawer */}
          {isFormOpen && (
            <form
              onSubmit={handleSubmit}
              className="bg-[#f0f7fb] border border-[#b9dcf0] rounded p-5 space-y-4 animate-[rise-in_220ms_cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#0063a3] flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4" />
                  <span>{editingId ? 'Edit Stakeholder Contact' : 'Add New Key Stakeholder'}</span>
                </h2>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-xs text-[#5b6770] hover:text-[#252a2e] cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="e.g. Sarah"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Surname / Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="e.g. Chen"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="sarah.chen@trimble.com"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Team / Department
                  </label>
                  <input
                    type="text"
                    value={team}
                    onChange={(e) => setTeam(e.target.value)}
                    placeholder="e.g. Executive Leadership"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                    list="team-suggestions"
                  />
                  <datalist id="team-suggestions">
                    {TEAMS_OPTIONS.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Involved With Multiple Area Tags */}
              <div>
                <label className="block text-[11px] font-semibold text-[#252a2e] mb-1.5">
                  Involved with
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INVOLVED_AREAS_OPTIONS.map((area) => {
                    const isChecked = involvedWith.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleInvolvedArea(area)}
                        className={`focus-ring px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 border ${
                          isChecked
                            ? 'bg-[#0063a3] text-white border-[#0063a3]'
                            : 'bg-white text-[#46535e] border-[#d8dce0] hover:border-[#0063a3]'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3" />}
                        <span>{area}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (415) 555-0199"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#252a2e] mb-1">
                    Role & Briefing Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Keynote opening speaker, VIP escort liaison"
                    className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-1.5 text-xs text-[#252a2e] focus:outline-hidden"
                  />
                </div>
              </div>

              {!editingId && (
                <label className="flex items-center gap-2 cursor-pointer text-xs text-[#46535e]">
                  <input
                    type="checkbox"
                    checked={alsoAddToBoothRoster}
                    onChange={(e) => setAlsoAddToBoothRoster(e.target.checked)}
                    className="rounded accent-[#0063a3] cursor-pointer"
                  />
                  <span>Also add to the booth staff roster</span>
                </label>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="focus-ring px-3 py-1.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#252a2e] bg-white border border-[#d8dce0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="focus-ring px-4 py-1.5 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white shadow-xs cursor-pointer"
                >
                  {editingId ? 'Save changes' : 'Add to directory'}
                </button>
              </div>
            </form>
          )}

          {/* Directory Count */}
          <div className="flex items-center justify-between text-xs text-[#5b6770]">
            <span>
              Showing <span className="font-semibold text-[#252a2e]">{filteredStakeholders.length}</span> stakeholders
            </span>
          </div>

          {/* Stakeholders Table */}
          <div className="bg-white border border-[#d8dce0] rounded overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f8f9fa] border-b border-[#d8dce0] text-[#5b6770] font-semibold">
                    <th className="py-2.5 px-4">Stakeholder</th>
                    <th className="py-2.5 px-4">Team</th>
                    <th className="py-2.5 px-4">Involved with</th>
                    <th className="py-2.5 px-4">Contact</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5e9ec]">
                  {filteredStakeholders.map((s) => (
                    <tr key={s.id} className="hover:bg-[#f8f9fa] transition-colors">
                      {/* Name & Role */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-[#252a2e]">
                          {s.firstName} {s.lastName}
                        </div>
                        {s.notes && (
                          <div className="text-[11px] text-[#5b6770] mt-0.5 line-clamp-1">
                            {s.notes}
                          </div>
                        )}
                      </td>

                      {/* Team */}
                      <td className="py-3 px-4 text-[#46535e]">
                        <span className="font-medium text-[#252a2e]">{s.team || 'General'}</span>
                      </td>

                      {/* Involved With Tags */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {s.involvedWith && s.involvedWith.length > 0 ? (
                            s.involvedWith.map((area) => (
                              <span
                                key={area}
                                className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                  area.includes('Keynote')
                                    ? 'bg-[#e5f2f8] text-[#0063a3] border-[#b9dcf0]'
                                    : area.includes('Booth')
                                      ? 'bg-[#ecfdf5] text-[#059669] border-[#a7f3d0]'
                                      : 'bg-[#f1f3f6] text-[#46535e] border-[#d8dce0]'
                                }`}
                              >
                                {area}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#5b6770]">—</span>
                          )}
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4 text-[11px] text-[#46535e]">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-[#5b6770] shrink-0" />
                          <span className="truncate">{s.email}</span>
                        </div>
                        {s.phone && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Phone className="w-3 h-3 text-[#5b6770] shrink-0" />
                            <span>{s.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(s)}
                            className="focus-ring p-1.5 text-[#46535e] hover:text-[#0063a3] rounded hover:bg-[#e5f2f8] transition-colors cursor-pointer"
                            title="Edit stakeholder"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id, `${s.firstName} ${s.lastName}`)}
                            className="focus-ring p-1.5 text-[#da3832] hover:bg-[#fdf2f2] rounded transition-colors cursor-pointer"
                            title="Delete stakeholder"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredStakeholders.length === 0 && (
              <div className="py-12 text-center text-xs text-[#5b6770] space-y-2">
                {stakeholders.length === 0 ? (
                  <>
                    <p>No key stakeholders yet.</p>
                    <button
                      type="button"
                      onClick={() => setStakeholders(addSampleStakeholders(event.id))}
                      className="focus-ring cursor-pointer rounded px-2 py-1 text-xs font-semibold text-[#46535e] underline hover:text-[#0063a3]"
                    >
                      Add sample data
                    </button>
                  </>
                ) : (
                  <p>No stakeholders found matching your filters.</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(true);
                  }}
                  className="focus-ring px-3 py-1.5 rounded text-xs font-semibold bg-[#0063a3] text-white hover:bg-[#005084] cursor-pointer"
                >
                  Add your first stakeholder
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#d8dce0] bg-[#f8f9fa] flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="focus-ring px-3 py-1.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#0063a3] border border-[#d8dce0] hover:border-[#0063a3] bg-white transition-colors cursor-pointer flex items-center space-x-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to menu</span>
          </button>
        </div>
      </section>
    </div>
  );
};
