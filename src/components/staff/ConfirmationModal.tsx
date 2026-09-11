import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import type { EventConfig, ShiftBooking, StaffMember, TimeSlot } from '@/types';
import { downloadStaffScheduleIcs } from '@/lib/calendar';
import { calculateSlotDurationMinutes, formatDuration, formatTime12h, formatDate } from '@/lib/utils';
import { toast } from '@/components/common/Toast';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: EventConfig;
  slots: TimeSlot[];
  currentStaff: StaffMember;
  onReleaseShift?: (slot: TimeSlot, booking: ShiftBooking) => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  config,
  slots,
  currentStaff,
  onReleaseShift,
}) => {
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Extract all shifts booked by this staff member
  const myBookedShifts: { slot: TimeSlot; booking: ShiftBooking }[] = [];
  for (const slot of slots) {
    const booking = slot.bookings.find((b) => b.staffId === currentStaff.id);
    if (booking) {
      myBookedShifts.push({ slot, booking });
    }
  }

  // Sort chronologically by date and startTime
  myBookedShifts.sort((a, b) => {
    if (a.slot.date !== b.slot.date) {
      return a.slot.date.localeCompare(b.slot.date);
    }
    return a.slot.startTime.localeCompare(b.slot.startTime);
  });

  // Fire celebratory micro-confetti when opened
  useEffect(() => {
    if (isOpen) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.65 },
          colors: ['#8b5cf6', '#10b981', '#38bdf8', '#fbbf24'],
        });
      } catch {
        // Safe fallback if canvas is restricted
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadIcs = () => {
    downloadStaffScheduleIcs(config, slots, currentStaff);
    toast.success('Calendar .ics file downloaded! Open in Apple Calendar or Outlook.', 'Calendar Export');
  };

  const handleCopySummary = () => {
    const lines = [
      `Expo Staffing Schedule: ${config.title}`,
      `Staff Representative: ${currentStaff.name}`,
      `Total Hours: ${currentStaff.totalBookedHours} hrs (${myBookedShifts.length} shifts)`,
      `Location: ${config.location}`,
      '',
      'My Scheduled Shifts:',
      ...myBookedShifts.map(
        ({ slot }, idx) =>
          `${idx + 1}. ${formatDate(slot.date)}: ${formatTime12h(slot.startTime)} - ${formatTime12h(slot.endTime)}`
      ),
      '',
      `Event Access: ${window.location.origin}${window.location.pathname}#/event/${config.publicKey}`,
    ];

    const summaryText = lines.join('\n');
    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    toast.success('Plaintext shift summary copied to clipboard!', 'Copied to Clipboard');
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handleGoogleCalendarSync = () => {
    if (myBookedShifts.length === 0) return;
    const first = myBookedShifts[0];
    const startIso = `${first.slot.date.replace(/-/g, '')}T${first.slot.startTime.replace(/:/g, '')}00Z`;
    const endIso = `${first.slot.date.replace(/-/g, '')}T${first.slot.endTime.replace(/:/g, '')}00Z`;
    const title = encodeURIComponent(`Expo Staffing: ${config.title}`);
    const details = encodeURIComponent(
      `Expo staffing shift for ${currentStaff.name}.\nEvent: ${config.title}\nLocation: ${config.location}`
    );
    const loc = encodeURIComponent(config.location);
    const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${loc}`;
    window.open(gCalUrl, '_blank');
  };

  const meetsTarget = currentStaff.totalBookedHours >= config.targetHoursPerStaff;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-[#d8dce0] rounded max-w-lg w-full p-6 space-y-5 shadow-modus-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#d8dce0] pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-[#00823b] bg-[#e6f5ec] px-2.5 py-0.5 rounded border border-[#a3e0be] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirmed Roster Shifts</span>
              </span>
              {meetsTarget && (
                <span className="text-[10px] bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#0063a3]" /> Target Met!
                </span>
              )}
            </div>

            <h3 className="text-xl font-bold text-[#252a2e] tracking-tight">
              {currentStaff.name}&rsquo;s Expo Schedule
            </h3>
            <p className="text-xs text-[#46535e]">
              {config.title} &bull; {myBookedShifts.length} {myBookedShifts.length === 1 ? 'shift' : 'shifts'} ({currentStaff.totalBookedHours} of {config.targetHoursPerStaff} hrs target)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#7c878e] hover:text-[#252a2e] rounded hover:bg-[#f1f3f6] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Booked Shifts Cards */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {myBookedShifts.length === 0 ? (
            <div className="p-8 text-center text-[#7c878e] text-xs">
              No shifts booked yet. Tap any open slot on the matrix grid to claim!
            </div>
          ) : (
            myBookedShifts.map(({ slot, booking }) => (
              <div
                key={booking.id}
                className="p-3 bg-[#f8f9fa] rounded border border-[#d8dce0] flex items-center justify-between group hover:border-[#0063a3] transition-colors"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-[#252a2e] font-mono">
                      {formatTime12h(slot.startTime)} &ndash; {formatTime12h(slot.endTime)}
                    </span>
                    <span className="text-[10px] text-[#46535e] bg-[#e7eaef] px-1.5 py-0.5 rounded font-mono">
                      {formatDuration(calculateSlotDurationMinutes(slot.startTime, slot.endTime))}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#46535e] flex items-center space-x-2">
                    <span className="text-[#0063a3] font-semibold">{formatDate(slot.date)}</span>
                    <span>&bull;</span>
                    <span className="truncate max-w-[170px]">{config.location}</span>
                  </div>
                </div>

                {onReleaseShift && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onReleaseShift(slot, booking);
                    }}
                    className="text-[11px] text-[#da3832] hover:bg-[#fdf2f2] px-2 py-1 rounded font-semibold transition-colors cursor-pointer"
                    title="Give up this slot"
                  >
                    Release
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Actions Grid */}
        <div className="space-y-3 pt-2 border-t border-[#d8dce0]">
          <div className="text-[11px] font-bold text-[#46535e] uppercase tracking-wider">
            Calendar Export & Sharing:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary Action: Add to Calendar (.ICS) */}
            <button
              type="button"
              onClick={handleDownloadIcs}
              className="p-3.5 bg-[#0063a3] hover:bg-[#005084] active:scale-98 text-white rounded shadow-xs text-left flex items-start space-x-3 transition-colors group cursor-pointer"
            >
              <Download className="w-5 h-5 text-[#b9dcf0] mt-0.5 shrink-0" />
              <div>
                <div className="text-xs font-bold">Add to Calendar (.ICS)</div>
                <div className="text-[10px] text-[#e5f2f8] leading-tight mt-0.5">
                  Universal calendar file for Apple Calendar & Outlook
                </div>
              </div>
            </button>

            {/* Secondary Action: Copy Plaintext Shift Summary */}
            <button
              type="button"
              onClick={handleCopySummary}
              className="p-3.5 bg-white hover:bg-[#f1f3f6] active:scale-98 border border-[#d8dce0] text-[#252a2e] rounded text-left flex items-start space-x-3 transition-colors group shadow-xs cursor-pointer"
            >
              {copiedSummary ? (
                <Check className="w-5 h-5 text-[#00823b] mt-0.5 shrink-0" />
              ) : (
                <Copy className="w-5 h-5 text-[#7c878e] group-hover:text-[#252a2e] mt-0.5 shrink-0" />
              )}
              <div>
                <div className="text-xs font-bold text-[#252a2e]">
                  {copiedSummary ? 'Copied to Clipboard!' : 'Copy Shift Summary'}
                </div>
                <div className="text-[10px] text-[#46535e] leading-tight mt-0.5">
                  Plaintext formatted list ready to send via Slack or DM
                </div>
              </div>
            </button>
          </div>

          {/* Tertiary Action: Google Calendar Web Link */}
          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={handleGoogleCalendarSync}
              className="text-xs text-[#0063a3] hover:text-[#005084] font-semibold inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Direct Google Calendar Link</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] text-xs font-semibold rounded transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
