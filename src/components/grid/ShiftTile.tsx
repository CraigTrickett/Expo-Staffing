import React from 'react';
import { Check, CheckCircle2, Clock, Plus, Trash2, User, Users } from 'lucide-react';
import type { ShiftBooking, TimeSlot, StaffMember } from '@/types';
import { cn, formatDuration, formatTime12h } from '@/lib/utils';

interface ShiftTileProps {
  slot: TimeSlot;
  currentIdentity: StaffMember | null;
  isAdmin?: boolean;
  onClaim?: (slotId: string) => void;
  onLeave?: (slotId: string, staffId: string) => void;
  onAdminRemove?: (slotId: string, staffId: string) => void;
  onRequestIdentity?: () => void;
  compact?: boolean;
}

export const ShiftTile: React.FC<ShiftTileProps> = ({
  slot,
  currentIdentity,
  isAdmin = false,
  onClaim,
  onLeave,
  onAdminRemove,
  onRequestIdentity,
  compact = false,
}) => {
  const isClaimedByMe = Boolean(
    currentIdentity && slot.bookings.some((b) => b.staffId === currentIdentity.id)
  );
  const isFull = slot.bookings.length >= slot.capacity;
  const spotsOpen = Math.max(0, slot.capacity - slot.bookings.length);
  const isPartiallyFilled = slot.bookings.length > 0 && !isFull;
  const isEmpty = slot.bookings.length === 0;

  // Calculate duration in minutes
  const [startH, startM] = slot.startTime.split(':').map((v) => parseInt(v, 10));
  const [endH, endM] = slot.endTime.split(':').map((v) => parseInt(v, 10));
  const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isClaimedByMe && currentIdentity) {
      onLeave?.(slot.id, currentIdentity.id);
    } else if (!isFull) {
      if (!currentIdentity && onRequestIdentity) {
        onRequestIdentity();
      } else {
        onClaim?.(slot.id);
      }
    }
  };

  return (
    <div
      id={`shift-tile-${slot.id}`}
      className={cn(
        'group relative rounded transition-all duration-150 flex flex-col justify-between select-none',
        compact ? 'p-3 text-xs' : 'p-3.5 text-sm',
        // State-based styling
        isClaimedByMe
          ? 'bg-[#e5f2f8] border-2 border-[#0063a3] shadow-modus-1'
          : isFull
            ? 'bg-[#f8f9fa] border border-[#d8dce0] opacity-90'
            : isPartiallyFilled
              ? 'bg-white border border-[#d8dce0] hover:border-[#0063a3] shadow-xs'
              : 'bg-white border border-dashed border-[#d8dce0] hover:border-[#0063a3] hover:shadow-xs'
      )}
    >
      <div>
        {/* Header: Time and Capacity indicator */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center space-x-1.5 font-mono font-bold text-[#252a2e] tracking-tight">
              <Clock className="w-3.5 h-3.5 text-[#7c878e] shrink-0" />
              <span className="truncate">
                {formatTime12h(slot.startTime)} &ndash; {formatTime12h(slot.endTime)}
              </span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-[#46535e] font-mono">
              <span>{formatDuration(durationMinutes)}</span>
              <span>&bull;</span>
              <span
                className={cn(
                  'font-semibold',
                  isFull
                    ? 'text-[#00823b]'
                    : isPartiallyFilled
                      ? 'text-[#8a5800]'
                      : 'text-[#7c878e]'
                )}
              >
                {slot.bookings.length}/{slot.capacity} filled
              </span>
            </div>
          </div>

          {/* Status badge */}
          <div className="shrink-0">
            {isClaimedByMe ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#0063a3] text-white shadow-xs">
                <Check className="w-3 h-3 stroke-[2.5]" />
                <span>You</span>
              </span>
            ) : isFull ? (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-bold bg-[#e6f5ec] text-[#00823b] border border-[#a3e0be]">
                <CheckCircle2 className="w-3 h-3 text-[#00823b]" />
                <span>Full</span>
              </span>
            ) : isPartiallyFilled ? (
              <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#fef8e8] text-[#8a5800] border border-[#f7c970]">
                <span>{spotsOpen} open</span>
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono text-[#46535e] bg-[#f1f3f6] border border-[#d8dce0]">
                {spotsOpen} open
              </span>
            )}
          </div>
        </div>

        {/* Assigned Staff Avatars / List */}
        <div className="mt-3 space-y-1.5">
          {isEmpty ? (
            <div className="py-2 px-2.5 rounded border border-dashed border-[#d8dce0] text-[11px] text-[#7c878e] flex items-center justify-center space-x-1.5 bg-[#f8f9fa]">
              <Users className="w-3.5 h-3.5 opacity-50" />
              <span>Shift open &bull; No staff assigned</span>
            </div>
          ) : (
            slot.bookings.map((booking: ShiftBooking) => {
              const isSelf = currentIdentity?.id === booking.staffId;
              return (
                <div
                  key={booking.id}
                  className={cn(
                    'group/booking px-2.5 py-1.5 rounded text-xs flex items-center justify-between border transition-colors',
                    isSelf
                      ? 'bg-[#e5f2f8] border-[#b9dcf0] text-[#0063a3] font-semibold'
                      : 'bg-[#f1f3f6] border-[#d8dce0] text-[#252a2e]'
                  )}
                >
                  <div className="flex items-center space-x-2 min-w-0 pr-1">
                    <div
                      className={cn(
                        'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 uppercase',
                        isSelf
                          ? 'bg-[#0063a3] text-white'
                          : 'bg-[#46535e] text-white'
                      )}
                    >
                      {booking.staffName ? booking.staffName.slice(0, 2) : <User className="w-2.5 h-2.5" />}
                    </div>
                    <span className="truncate text-xs font-medium">{booking.staffName}</span>
                  </div>

                  {/* Admin or self removal */}
                  {(isAdmin || isSelf) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isAdmin) {
                          onAdminRemove?.(slot.id, booking.staffId);
                        } else if (isSelf) {
                          onLeave?.(slot.id, booking.staffId);
                        }
                      }}
                      className="opacity-70 group-hover/booking:opacity-100 hover:text-[#da3832] p-0.5 rounded transition-all text-[#7c878e] hover:bg-[#fdf2f2] cursor-pointer"
                      title={isAdmin ? `Remove ${booking.staffName}` : 'Cancel your shift'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3 pt-2.5 border-t border-[#d8dce0]">
        {isClaimedByMe ? (
          <button
            type="button"
            onClick={handleAction}
            className="w-full py-1.5 px-3 rounded text-xs font-semibold bg-white hover:bg-[#fdf2f2] text-[#0063a3] hover:text-[#da3832] border border-[#0063a3] hover:border-[#da3832] transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <Check className="w-3.5 h-3.5 text-[#0063a3]" />
            <span>Claimed &bull; Click to release</span>
          </button>
        ) : isFull ? (
          <div className="w-full py-1.5 px-3 rounded text-xs font-mono text-[#7c878e] bg-[#e7eaef] text-center border border-[#d8dce0]">
            Shift fully booked
          </div>
        ) : (
          <button
            type="button"
            onClick={handleAction}
            className="w-full py-1.5 px-3 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white border border-[#0063a3] transition-colors flex items-center justify-center space-x-1.5 shadow-xs active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{currentIdentity ? 'Claim This Shift' : 'Sign Up for Shift'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
