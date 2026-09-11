import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Share2,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useBoothDutyStore } from '@/store';
import { ShiftMatrix } from '../grid/ShiftMatrix';
import { cn, formatDate, formatTime12h } from '@/lib/utils';
import { downloadIcs, generateIcsFile } from '@/lib/calendar';

interface PublicShiftPickerProps {
  publicKey: string;
}

export const PublicShiftPicker: React.FC<PublicShiftPickerProps> = ({ publicKey }) => {
  const {
    config,
    slots,
    roster,
    session,
    addBooking,
    removeBooking,
    claimIdentity,
  } = useBoothDutyStore();

  const [copiedLink, setCopiedLink] = useState(false);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);

  if (!config) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center space-y-4">
        <h2 className="text-xl font-bold text-[#252a2e]">Event Schedule Not Found</h2>
        <p className="text-sm text-[#46535e]">
          The requested Expo Staffing schedule could not be loaded. Check your link or create a new
          schedule.
        </p>
        <a
          href="#/"
          className="inline-block px-4 py-2 bg-[#0063a3] hover:bg-[#005084] text-white rounded text-xs font-semibold shadow-xs transition-colors"
        >
          Create New Schedule
        </a>
      </div>
    );
  }

  const currentRep = session.currentIdentity;

  const myBookedSlots = currentRep
    ? slots.filter((s) => s.bookings.some((b) => b.staffId === currentRep.id))
    : [];

  const handleClaimSlot = (slotId: string) => {
    if (!currentRep) {
      setPendingSlotId(slotId);
      setShowIdentityModal(true);
      return;
    }

    const success = addBooking(slotId, currentRep);
    if (success) {
      // Check if user has now met target
      const slotDuration = (config.slotDurationMinutes || 60) / 60;
      const newTotal = currentRep.totalBookedHours + slotDuration;
      if (newTotal >= currentRep.targetHours && currentRep.totalBookedHours < currentRep.targetHours) {
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
            colors: ['#0063a3', '#00823b', '#e5f2f8', '#252a2e'],
          });
        } catch {
          // ignore confetti failure in headless/restricted environment
        }
      }
    }
  };

  const handleLeaveSlot = (slotId: string, staffId: string) => {
    removeBooking(slotId, staffId);
  };

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempName.trim()) return;

    const claimed = claimIdentity(tempName.trim());
    setShowIdentityModal(false);
    setTempName('');

    if (pendingSlotId) {
      addBooking(pendingSlotId, claimed);
      setPendingSlotId(null);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadMySchedule = () => {
    if (!currentRep || myBookedSlots.length === 0) return;
    const myBookings: { slot: (typeof slots)[0]; booking: (typeof slots)[0]['bookings'][0] }[] = [];
    for (const slot of myBookedSlots) {
      const b = slot.bookings.find((item) => item.staffId === currentRep.id);
      if (b) {
        myBookings.push({ slot, booking: b });
      }
    }
    const ics = generateIcsFile(config, myBookings);
    const filename = `${config.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${currentRep.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.ics`;
    downloadIcs(filename, ics);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
      {/* Target Progress & My Assigned Shifts Summary Card */}
      {currentRep ? (
        <div className="bg-white border border-[#d8dce0] rounded p-5 shadow-modus-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0063a3]" />
                <h3 className="font-bold text-[#252a2e] text-base">{currentRep.name}</h3>
                {currentRep.totalBookedHours >= currentRep.targetHours && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-bold bg-[#e6f5ec] text-[#00823b] border border-[#a3e0be]">
                    <CheckCircle2 className="w-3 h-3 text-[#00823b]" />
                    <span>Target Completed!</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-[#46535e]">
                You have claimed {myBookedSlots.length} shifts totaling{' '}
                <span className="font-mono text-[#252a2e] font-bold">
                  {currentRep.totalBookedHours} hours
                </span>{' '}
                (target: {currentRep.targetHours}h).
              </p>
            </div>

            <div className="flex items-center space-x-2 self-start md:self-auto">
              {myBookedSlots.length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadMySchedule}
                  className="px-3.5 py-2 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Add to Calendar (.ics)</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded text-xs font-semibold bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5 text-[#7c878e]" />
                <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#e5f2f8] border border-[#b9dcf0] rounded p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-[#0063a3] font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>Sign Up for Expo Staffing Shifts</span>
            </div>
            <p className="text-xs text-[#46535e] max-w-xl">
              Select any open time slot on the schedule below to claim your spot. No passwords
              needed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowIdentityModal(true)}
            className="px-4 py-2 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
          >
            Identify Yourself
          </button>
        </div>
      )}

      {/* Shifts Matrix */}
      <ShiftMatrix
        slots={slots}
        currentIdentity={currentRep}
        isAdmin={false}
        onClaim={handleClaimSlot}
        onLeave={handleLeaveSlot}
        onRequestIdentity={() => setShowIdentityModal(true)}
      />

      {/* Identity Dialog */}
      {showIdentityModal && (
        <div className="fixed inset-0 z-50 bg-[#252a2e]/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-[#d8dce0] rounded max-w-md w-full p-6 shadow-modus-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-[#0063a3]" />
                <h3 className="font-bold text-[#252a2e] text-base">Claim Shift Identity</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowIdentityModal(false);
                  setPendingSlotId(null);
                }}
                className="text-[#7c878e] hover:text-[#252a2e] text-xs px-2.5 py-1 rounded bg-[#f1f3f6] hover:bg-[#e7eaef] font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {/* Quick Pick from Roster */}
            {roster.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-[#46535e] mb-1.5">
                  Or choose your name from team roster:
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1 bg-[#f8f9fa] p-2 rounded border border-[#d8dce0]">
                  {roster.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        claimIdentity(m.name);
                        setShowIdentityModal(false);
                        if (pendingSlotId) {
                          addBooking(pendingSlotId, m);
                          setPendingSlotId(null);
                        }
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-[#e5f2f8] text-[#252a2e] hover:text-[#0063a3] transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="text-[10px] font-mono text-[#7c878e]">
                        {m.totalBookedHours}h / {m.targetHours}h
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Or type name */}
            <form onSubmit={handleIdentitySubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#252a2e] mb-1">
                  Enter your full name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="e.g., Sarah Connor"
                  className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3 py-2 text-sm text-[#252a2e] placeholder:text-[#7c878e] focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowIdentityModal(false);
                    setPendingSlotId(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-[#46535e] hover:text-[#252a2e] rounded bg-white hover:bg-[#f1f3f6] border border-[#d8dce0] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white rounded bg-[#0063a3] hover:bg-[#005084] shadow-xs cursor-pointer"
                >
                  Continue &amp; Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
