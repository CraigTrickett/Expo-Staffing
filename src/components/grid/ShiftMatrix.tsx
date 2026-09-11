import React, { useState, useMemo } from 'react';
import { Calendar, Filter, Sparkles } from 'lucide-react';
import type { EventConfig, StaffMember, TimeSlot } from '@/types';
import { ShiftTile } from './ShiftTile';
import { cn, formatDate } from '@/lib/utils';

interface ShiftMatrixProps {
  slots: TimeSlot[];
  config?: EventConfig;
  currentIdentity: StaffMember | null;
  isAdmin?: boolean;
  onClaim?: (slotId: string) => void;
  onLeave?: (slotId: string, staffId: string) => void;
  onAdminRemove?: (slotId: string, staffId: string) => void;
  onRequestIdentity?: () => void;
  onSlotClick?: (slotId: string) => void;
}

type FilterMode = 'all' | 'open' | 'mine' | 'full';

export const ShiftMatrix: React.FC<ShiftMatrixProps> = ({
  slots,
  config,
  currentIdentity,
  isAdmin = false,
  onClaim,
  onLeave,
  onAdminRemove,
  onRequestIdentity,
  onSlotClick,
}) => {
  const [filter, setFilter] = useState<FilterMode>('all');

  // Group slots by date (YYYY-MM-DD)
  const groupedByDate = useMemo(() => {
    const map = new Map<string, TimeSlot[]>();
    for (const slot of slots) {
      const existing = map.get(slot.date) || [];
      existing.push(slot);
      map.set(slot.date, existing);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  // Mobile active tab date
  const [selectedMobileDate, setSelectedMobileDate] = useState<string>(
    groupedByDate[0]?.[0] || ''
  );

  // Update selectedMobileDate if date list changes
  React.useEffect(() => {
    if (groupedByDate.length > 0 && !groupedByDate.some(([d]) => d === selectedMobileDate)) {
      setSelectedMobileDate(groupedByDate[0][0]);
    }
  }, [groupedByDate, selectedMobileDate]);

  // Filter helper
  const filterSlot = (slot: TimeSlot) => {
    if (filter === 'open') {
      return slot.bookings.length < slot.capacity;
    }
    if (filter === 'mine') {
      return (
        currentIdentity &&
        slot.bookings.some((b) => b.staffId === currentIdentity.id)
      );
    }
    if (filter === 'full') {
      return slot.bookings.length >= slot.capacity;
    }
    return true;
  };

  const myBookingsCount = useMemo(() => {
    if (!currentIdentity) return 0;
    return slots.filter((s) => s.bookings.some((b) => b.staffId === currentIdentity.id)).length;
  }, [slots, currentIdentity]);

  const openSlotsCount = useMemo(() => {
    return slots.filter((s) => s.bookings.length < s.capacity).length;
  }, [slots]);

  const effectiveClaim = onSlotClick || onClaim;

  return (
    <div className="space-y-4">
      {/* Control / Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#d8dce0] p-3 rounded shadow-modus-1">
        <div className="flex items-center space-x-2 text-xs text-[#46535e] flex-wrap gap-y-1.5">
          <Filter className="w-3.5 h-3.5 text-[#7c878e]" />
          <span className="font-bold text-[#252a2e]">Filter Shifts:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer',
                filter === 'all'
                  ? 'bg-[#0063a3] text-white shadow-xs'
                  : 'text-[#46535e] hover:text-[#252a2e] hover:bg-[#f1f3f6]'
              )}
            >
              All ({slots.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('open')}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border',
                filter === 'open'
                  ? 'bg-[#fef8e8] text-[#8a5800] border-[#f7c970] shadow-xs'
                  : 'text-[#46535e] hover:text-[#252a2e] hover:bg-[#f1f3f6] border-transparent'
              )}
            >
              Needs Staff ({openSlotsCount})
            </button>
            {currentIdentity && (
              <button
                type="button"
                onClick={() => setFilter('mine')}
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border',
                  filter === 'mine'
                    ? 'bg-[#e5f2f8] text-[#0063a3] border-[#b9dcf0] shadow-xs'
                    : 'text-[#46535e] hover:text-[#252a2e] hover:bg-[#f1f3f6] border-transparent'
                )}
              >
                My Shifts ({myBookingsCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilter('full')}
              className={cn(
                'px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer border',
                filter === 'full'
                  ? 'bg-[#e6f5ec] text-[#00823b] border-[#a3e0be] shadow-xs'
                  : 'text-[#46535e] hover:text-[#252a2e] hover:bg-[#f1f3f6] border-transparent'
              )}
            >
              Fully Staffed
            </button>
          </div>
        </div>

        {currentIdentity && (
          <div className="text-xs text-[#46535e] flex items-center space-x-1.5 self-end sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-[#0063a3]" />
            <span className="text-[#252a2e] font-bold">{currentIdentity.name}</span>
            <span>&bull;</span>
            <span className="font-mono text-[#0063a3] font-bold">
              {currentIdentity.totalBookedHours}h / {currentIdentity.targetHours}h booked
            </span>
          </div>
        )}
      </div>

      {/* MOBILE VIEW (Screens < 1024px): Day Tabs Selector + Stacked Thumb-friendly Cards */}
      <div className="block lg:hidden space-y-4">
        {/* Day Selector Segmented Tab Bar */}
        <div className="flex items-center overflow-x-auto no-scrollbar gap-1.5 p-1 bg-white border border-[#d8dce0] rounded shadow-modus-1">
          {groupedByDate.map(([dateString, daySlots], index) => {
            const isSelected = dateString === selectedMobileDate;
            const openInDay = daySlots.filter((s) => s.bookings.length < s.capacity).length;
            return (
              <button
                key={dateString}
                type="button"
                onClick={() => setSelectedMobileDate(dateString)}
                className={cn(
                  'flex-1 min-w-[120px] px-3 py-2 rounded text-xs font-medium text-center transition-all cursor-pointer shrink-0',
                  isSelected
                    ? 'bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0] shadow-xs font-bold'
                    : 'text-[#46535e] hover:text-[#252a2e] hover:bg-[#f8f9fa]'
                )}
              >
                <div className="font-bold">{`Day ${index + 1}`}</div>
                <div className="text-[11px] text-[#7c878e] truncate">{formatDate(dateString)}</div>
                {openInDay > 0 && (
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] bg-[#fef8e8] text-[#8a5800] border border-[#f7c970] font-mono font-semibold">
                    {openInDay} open
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day's Slots */}
        {groupedByDate
          .filter(([dateString]) => dateString === selectedMobileDate)
          .map(([dateString, daySlots]) => {
            const visibleSlots = daySlots.filter(filterSlot);
            return (
              <div key={dateString} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-bold text-[#252a2e]">
                    {formatDate(dateString)}
                  </span>
                  <span className="text-xs text-[#7c878e] font-mono font-semibold">
                    {visibleSlots.length} shifts
                  </span>
                </div>

                {visibleSlots.length === 0 ? (
                  <div className="p-8 text-center bg-white border border-[#d8dce0] rounded text-xs text-[#7c878e]">
                    No shifts matching the selected filter for this day.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {visibleSlots.map((slot) => (
                      <ShiftTile
                        key={slot.id}
                        slot={slot}
                        currentIdentity={currentIdentity}
                        isAdmin={isAdmin}
                        onClaim={effectiveClaim}
                        onLeave={onLeave}
                        onAdminRemove={onAdminRemove}
                        onRequestIdentity={onRequestIdentity}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* DESKTOP VIEW (Screens >= 1024px): Multi-column Side-by-Side Day Columns */}
      <div className="hidden lg:block">
        <div
          className={cn(
            'grid gap-4 items-start',
            groupedByDate.length === 1
              ? 'grid-cols-1 max-w-2xl mx-auto'
              : groupedByDate.length === 2
                ? 'grid-cols-2'
                : groupedByDate.length === 3
                  ? 'grid-cols-3'
                  : 'grid-cols-4'
          )}
        >
          {groupedByDate.map(([dateString, daySlots], index) => {
            const visibleSlots = daySlots.filter(filterSlot);
            const openInDay = daySlots.filter((s) => s.bookings.length < s.capacity).length;

            return (
              <div
                key={dateString}
                className="bg-[#f8f9fa] border border-[#d8dce0] rounded overflow-hidden flex flex-col shadow-modus-1"
              >
                {/* Column Sticky Header */}
                <div className="sticky top-16 z-20 px-4 py-3 bg-white border-b border-[#d8dce0] backdrop-blur-md flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#0063a3] font-mono">
                        Day {index + 1}
                      </span>
                      {openInDay > 0 ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#fef8e8] text-[#8a5800] border border-[#f7c970] font-mono font-semibold">
                          {openInDay} open
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e6f5ec] text-[#00823b] border border-[#a3e0be] font-mono font-semibold">
                          All Filled
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-[#252a2e] mt-0.5">
                      {formatDate(dateString)}
                    </h3>
                  </div>
                  <Calendar className="w-4 h-4 text-[#7c878e]" />
                </div>

                {/* Slots Stack */}
                <div className="p-3.5 space-y-3 flex-1">
                  {visibleSlots.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#7c878e] border border-dashed border-[#d8dce0] rounded bg-white">
                      No matching shifts
                    </div>
                  ) : (
                    visibleSlots.map((slot) => (
                      <ShiftTile
                        key={slot.id}
                        slot={slot}
                        currentIdentity={currentIdentity}
                        isAdmin={isAdmin}
                        onClaim={effectiveClaim}
                        onLeave={onLeave}
                        onAdminRemove={onAdminRemove}
                        onRequestIdentity={onRequestIdentity}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
