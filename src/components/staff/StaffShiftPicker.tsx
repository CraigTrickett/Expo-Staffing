import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Lock,
  MapPin,
  Sparkles,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useEventStore } from '@/store/useEventStore';
import { IdentityBar } from './IdentityBar';
import { ShiftMatrix } from '../grid/ShiftMatrix';
import { ConfirmationModal } from './ConfirmationModal';
import { ReleaseShiftModal } from './ReleaseShiftModal';
import { downloadStaffScheduleIcs } from '@/lib/calendar';
import { cn, formatDuration, formatTime12h, roundTargetHoursForDisplay } from '@/lib/utils';
import { toast } from '@/components/common/Toast';
import type { ShiftBooking, TimeSlot } from '@/types';

interface StaffShiftPickerProps {
  publicKey: string;
}

export const StaffShiftPicker: React.FC<StaffShiftPickerProps> = ({ publicKey }) => {
  const {
    currentEvent,
    slots,
    roster,
    currentStaff,
    metrics,
    isLoading,
    error,
    loadEventByKey,
    claimIdentity,
    claimShift,
    releaseShift,
    clearError,
    resetToDemo,
  } = useEventStore();

  const [slotToCancel, setSlotToCancel] = useState<{ slot: TimeSlot; booking: ShiftBooking } | null>(null);
  const [identityPromptTrigger, setIdentityPromptTrigger] = useState(0);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [justClaimedSlotId, setJustClaimedSlotId] = useState<string | null>(null);

  useEffect(() => {
    loadEventByKey(publicKey);
  }, [publicKey, loadEventByKey]);

  // Find all shifts booked by current staff
  const myBookedShifts: { slot: TimeSlot; booking: ShiftBooking }[] = [];
  if (currentStaff) {
    for (const slot of slots) {
      const booking = slot.bookings.find((b) => b.staffId === currentStaff.id);
      if (booking) {
        myBookedShifts.push({ slot, booking });
      }
    }
  }

  // Handle shift click from matrix
  const handleSlotClick = async (slotId: string) => {
    if (!currentStaff) {
      // Make it unmistakable what to do next: scroll the identity picker
      // into view, force it open, give it a brief highlight, and say why
      // — rather than a silent scroll with no explanation.
      document.getElementById('identity-bar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIdentityPromptTrigger((n) => n + 1);
      toast.info('Select your name first, then claim this shift.', 'Who Are You?');
      return;
    }

    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return;

    // Check if user already booked this slot
    const existingBooking = slot.bookings.find((b) => b.staffId === currentStaff.id);
    if (existingBooking) {
      // Open cancellation prompt
      setSlotToCancel({ slot, booking: existingBooking });
      return;
    }

    // Check capacity
    if (slot.bookings.length >= slot.capacity) {
      return; // Slot full
    }

    // Optimistic 1-tap claim
    setJustClaimedSlotId(slotId);
    setTimeout(() => setJustClaimedSlotId(null), 1000);

    // Captured before the claim so the post-claim check below can tell
    // whether this specific claim is what crossed the target — not just
    // whether the target happens to currently be met, which would fire
    // confetti again on every claim after the first time it's reached.
    const preClaimHours = currentStaff.totalBookedHours;

    const success = await claimShift(slotId);

    // Only celebrate the moment the target is actually crossed.
    if (success && currentEvent) {
      const updatedStaff = useEventStore.getState().currentStaff;
      if (
        updatedStaff &&
        preClaimHours < metrics.dynamicTargetHours &&
        updatedStaff.totalBookedHours >= metrics.dynamicTargetHours
      ) {
        try {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.8 },
            colors: ['#8b5cf6', '#10b981', '#38bdf8', '#f59e0b'],
          });
        } catch {
          // ignore if canvas blocked
        }
      }
    }
  };

  const handleConfirmCancel = async () => {
    if (!slotToCancel) return;
    await releaseShift(slotToCancel.slot.id, slotToCancel.booking.id);
    setSlotToCancel(null);
  };

  const handleDownloadIcs = () => {
    if (!currentEvent || !currentStaff) return;
    downloadStaffScheduleIcs(currentEvent, slots, currentStaff);
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto py-20 px-4 flex flex-col items-center justify-center space-y-4 text-center">
        <div className="w-10 h-10 border-4 border-[#0063a3]/20 border-t-[#0063a3] rounded-full animate-spin" />
        <p className="text-sm text-[#46535e] font-semibold">Loading Expo Staffing Shifts...</p>
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
          No active schedule was found for access key <code className="text-[#252a2e] bg-[#e7eaef] px-1.5 py-0.5 rounded">{publicKey}</code>.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={resetToDemo}
            className="focus-ring px-4 py-2 bg-[#0063a3] hover:bg-[#005084] text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            Load Demo Schedule
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Sticky Identity Bar */}
      <IdentityBar
        roster={roster}
        currentStaff={currentStaff}
        targetHours={metrics.dynamicTargetHours}
        onSelectStaff={(staffId) => claimIdentity(staffId)}
        onAddNewStaff={(name, email) => claimIdentity('new', name, email)}
        forceOpenTrigger={identityPromptTrigger}
      />

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Error notification */}
        {error && (
          <div className="bg-[#fdf2f2] border border-[#f5c6c6] text-[#da3832] px-4 py-3 rounded text-xs flex items-center justify-between font-semibold">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-[#da3832] shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={clearError}
              className="focus-ring rounded text-[#da3832] hover:text-[#b0221d] p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Event Header Card */}
        <div className="bg-white border border-[#d8dce0] rounded p-5 shadow-modus-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-[#46535e] font-mono font-semibold">
                Target: ~{roundTargetHoursForDisplay(metrics.dynamicTargetHours)}h per person
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[#252a2e] tracking-tight mt-1">
              {currentEvent.title}
            </h1>
            <div className="flex items-center space-x-4 text-xs text-[#46535e] mt-1 flex-wrap gap-y-1">
              {currentEvent.location && (
                <>
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3.5 h-3.5 text-[#7c878e]" />
                    <span>{currentEvent.location}</span>
                  </span>
                  <span>&bull;</span>
                </>
              )}
              <span className="flex items-center space-x-1">
                <Calendar className="w-3.5 h-3.5 text-[#7c878e]" />
                <span>{currentEvent.startDate} to {currentEvent.endDate}</span>
              </span>
              <span>&bull;</span>
              <span className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-[#7c878e]" />
                <span>{currentEvent.dailyStartTime} - {currentEvent.dailyEndTime}</span>
              </span>
            </div>
          </div>

          {/* Quick instructions pill */}
          <div className="bg-[#f8f9fa] border border-[#d8dce0] rounded p-3 text-xs text-[#252a2e] max-w-sm">
            <div className="font-bold text-[#252a2e] mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#0063a3]" />
              <span>How it works:</span>
            </div>
            <p className="text-[11px] text-[#46535e] leading-relaxed">
              1. Confirm your name in the top bar. <br />
              2. Tap any open slot to claim instantly. <br />
              3. Tap your claimed slot anytime to release it.
            </p>
          </div>
        </div>

        {/* Matrix Instructions & Legend */}
        <div className="flex items-center justify-between text-xs text-[#46535e] flex-wrap gap-2">
          <span>Click any open shift to claim. Your claimed shifts show in primary blue.</span>
          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-[#e5f2f8] border border-[#0063a3] inline-block" />
              <span className="text-[#0063a3] font-semibold">Your Shift</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-white border border-[#d8dce0] inline-block" />
              <span className="text-[#46535e]">Open Spot</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded bg-[#e7eaef] border border-[#d8dce0] inline-flex items-center justify-center">
                <Lock className="w-2 h-2 text-[#7c878e]" />
              </span>
              <span className="text-[#7c878e]">Full (Locked)</span>
            </span>
          </div>
        </div>

        {/* Interactive Matrix View */}
        <ShiftMatrix
          slots={slots}
          config={currentEvent}
          currentIdentity={currentStaff}
          targetHours={metrics.dynamicTargetHours}
          isAdmin={false}
          onSlotClick={handleSlotClick}
          onLeave={(slotId, staffId) => {
            const slot = slots.find((s) => s.id === slotId);
            const booking = slot?.bookings.find((b) => b.staffId === staffId);
            if (slot && booking) {
              setSlotToCancel({ slot, booking });
            }
          }}
        />
      </div>

      {/* Sticky Bottom Floating Action Pill: "[X] shifts booked · View Confirmation & Sync Calendar" */}
      {currentStaff && myBookedShifts.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 max-w-lg w-full px-4 animate-in slide-in-from-bottom duration-200">
          <button
            type="button"
            onClick={() => setShowSyncModal(true)}
            className="focus-ring w-full bg-[#0063a3] hover:bg-[#005084] active:scale-98 text-white p-3.5 rounded shadow-modus-3 border border-[#005084] flex items-center justify-between transition-colors group cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded bg-white/20 flex items-center justify-center font-bold text-xs">
                {myBookedShifts.length}
              </div>
              <div className="text-left">
                <div className="text-xs font-bold tracking-tight">
                  {myBookedShifts.length} {myBookedShifts.length === 1 ? 'shift' : 'shifts'} booked ({currentStaff.totalBookedHours} hrs)
                </div>
                <div className="text-[11px] text-[#b9dcf0]">
                  Target: ~{roundTargetHoursForDisplay(metrics.dynamicTargetHours)} hrs &bull; Click to view & sync calendar
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/20 group-hover:bg-white/30 rounded text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              <span>Sync Calendar</span>
            </div>
          </button>
        </div>
      )}

      {/* Two-Tap Shift Release Modal (SCR-07) */}
      <ReleaseShiftModal
        isOpen={Boolean(slotToCancel)}
        onClose={() => setSlotToCancel(null)}
        slot={slotToCancel?.slot || null}
        booking={slotToCancel?.booking || null}
        eventLocation={currentEvent.location}
        onConfirmRelease={async (slotId, bookingId) => {
          await releaseShift(slotId, bookingId);
          setSlotToCancel(null);
        }}
      />

      {/* Confirmation & Calendar Sync Modal (SCR-06) */}
      {currentStaff && (
        <ConfirmationModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          config={currentEvent}
          slots={slots}
          currentStaff={currentStaff}
          targetHours={metrics.dynamicTargetHours}
          onReleaseShift={(slot, booking) => {
            setSlotToCancel({ slot, booking });
          }}
        />
      )}
    </div>
  );
};
