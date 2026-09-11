import React, { useState } from 'react';
import { AlertCircle, Clock, MapPin, Trash2, User, X } from 'lucide-react';
import type { ShiftBooking, TimeSlot } from '@/types';
import { calculateSlotDurationMinutes, formatDuration, formatTime12h, formatDate } from '@/lib/utils';
import { toast } from '@/components/common/Toast';

interface ReleaseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot: TimeSlot | null;
  booking: ShiftBooking | null;
  eventLocation?: string;
  onConfirmRelease: (slotId: string, bookingId: string) => Promise<boolean | void>;
}

export const ReleaseShiftModal: React.FC<ReleaseShiftModalProps> = ({
  isOpen,
  onClose,
  slot,
  booking,
  eventLocation,
  onConfirmRelease,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen || !slot || !booking) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmRelease(slot.id, booking.id);
      toast.info(`Shift released for ${formatTime12h(slot.startTime)}. Slot is now open for others.`);
      onClose();
    } catch {
      toast.error('Failed to release shift. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-[#d8dce0] rounded max-w-sm w-full p-6 space-y-4 shadow-modus-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#d8dce0] pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 rounded bg-[#fdf2f2] text-[#da3832] border border-[#f5c6c6] shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#252a2e] tracking-tight">
                Release Shift?
              </h3>
              <p className="text-xs text-[#46535e]">
                Give up your expo staffing spot for this time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-[#7c878e] hover:text-[#252a2e] rounded hover:bg-[#f1f3f6] transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shift Details Card */}
        <div className="bg-[#f8f9fa] p-4 rounded border border-[#d8dce0] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#252a2e] font-mono">
              {formatTime12h(slot.startTime)} &ndash; {formatTime12h(slot.endTime)}
            </span>
            <span className="text-[10px] text-[#46535e] bg-[#e7eaef] px-1.5 py-0.5 rounded font-mono">
              {formatDuration(calculateSlotDurationMinutes(slot.startTime, slot.endTime))}
            </span>
          </div>

          <div className="text-xs text-[#0063a3] font-semibold flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#7c878e]" />
            <span>{formatDate(slot.date)}</span>
          </div>

          {eventLocation && (
            <div className="text-[11px] text-[#46535e] flex items-center gap-1.5 truncate">
              <MapPin className="w-3.5 h-3.5 text-[#7c878e] shrink-0" />
              <span className="truncate">{eventLocation}</span>
            </div>
          )}

          <div className="pt-1 text-[11px] text-[#46535e] font-mono border-t border-[#d8dce0] mt-1 flex items-center gap-1">
            <User className="w-3 h-3 text-[#7c878e]" />
            <span>Booked by: <strong className="text-[#252a2e]">{booking.staffName}</strong></span>
          </div>
        </div>

        <p className="text-[11px] text-[#46535e] leading-relaxed">
          Releasing this shift will free up the spot immediately so another team member can sign up.
        </p>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] rounded text-xs font-semibold transition-colors cursor-pointer"
          >
            Keep Shift
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="px-4 py-2 bg-[#da3832] hover:bg-[#b0221d] active:scale-98 text-white rounded text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <span>Releasing...</span>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Release Shift</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
