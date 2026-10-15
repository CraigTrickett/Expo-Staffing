import React, { useMemo, useState } from 'react';
import { Calendar, Clock, Users, ArrowRight, Zap, Plus, Minus, MapPin, Globe } from 'lucide-react';
import type { SlotDuration } from '@/types';
import { cn, getBrowserTimezone, getTimezoneOptions } from '@/lib/utils';
import { useEventStore } from '@/store/useEventStore';
import { planEvent } from '@/lib/eventPlan';

interface CreateEventWizardProps {
  onEventCreated?: (adminKey: string) => void;
}

/** The names pasted into the roster box: one per line or comma, trimmed, none blank. */
const parseRoster = (raw: string): string[] =>
  raw
    .split(/[\n,]+/)
    .map((n) => n.trim().slice(0, 100))
    .filter(Boolean);

export const CreateEventWizard: React.FC<CreateEventWizardProps> = ({ onEventCreated }) => {
  // Helper to compute default dates (tomorrow and day after)
  const today = new Date();
  const defaultStart = new Date(today);
  defaultStart.setDate(today.getDate() + 7);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultStart.getDate() + 1);

  const formatDateInput = (d: Date) => d.toISOString().split('T')[0];

  // Form State
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [timezone, setTimezone] = useState(getBrowserTimezone());
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);
  const [startDate, setStartDate] = useState(formatDateInput(defaultStart));
  const [endDate, setEndDate] = useState(formatDateInput(defaultEnd));
  const [dailyStartTime, setDailyStartTime] = useState('09:00');
  const [dailyEndTime, setDailyEndTime] = useState('18:00');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState<SlotDuration>(60);
  const [staffCapacityPerSlot, setStaffCapacityPerSlot] = useState(2);
  const [rosterRaw, setRosterRaw] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const plan = useMemo(
    () =>
      planEvent({ startDate, endDate, dailyStartTime, dailyEndTime, slotDurationMinutes, staffCapacityPerSlot, rosterCount: parseRoster(rosterRaw).length }),
    [startDate, endDate, dailyStartTime, dailyEndTime, slotDurationMinutes, staffCapacityPerSlot, rosterRaw]
  );

  // Quick preset templates for rapid setup
  const applyPreset = (presetType: 'tech-expo' | 'single-day' | 'intensive') => {
    if (presetType === 'tech-expo') {
      setDailyStartTime('09:00');
      setDailyEndTime('18:00');
      setSlotDurationMinutes(60);
      setStaffCapacityPerSlot(2);
    } else if (presetType === 'single-day') {
      setEndDate(startDate);
      setDailyStartTime('10:00');
      setDailyEndTime('16:00');
      setSlotDurationMinutes(90);
      setStaffCapacityPerSlot(3);
    } else if (presetType === 'intensive') {
      setDailyStartTime('08:30');
      setDailyEndTime('18:30');
      setSlotDurationMinutes(60);
      setStaffCapacityPerSlot(4);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!title.trim()) {
      setValidationError('Please specify an event name.');
      return;
    }

    if (plan.errors.length > 0) {
      setValidationError(plan.errors[0]);
      return;
    }

    setIsSubmitting(true);

    // Parse initial roster
    const rosterLines = parseRoster(rosterRaw);

    // Save into Zustand Event Store (with localStorage multi-event persistence)
    const createdEvent = useEventStore.getState().createEvent({
      title,
      location: location.trim(),
      timezone,
      startDate,
      endDate,
      dailyStartTime,
      dailyEndTime,
      slotDurationMinutes,
      staffCapacityPerSlot,
      rosterNames: rosterLines,
    });

    // Trigger callback or route directly to admin console
    if (onEventCreated) {
      onEventCreated(createdEvent.adminKey);
    } else {
      window.location.hash = `#/admin/${createdEvent.adminKey}`;
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-10 px-4">
      {/* Wizard Header Hero */}
      <div className="text-center space-y-3 mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#252a2e]">
          Create Expo Schedule
        </h1>
        {/* Quick Presets */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={() => applyPreset('tech-expo')}
            className="text-xs px-3 py-1.5 rounded bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] transition-colors cursor-pointer font-semibold shadow-xs"
          >
            Multi-day expo
          </button>
          <button
            type="button"
            onClick={() => applyPreset('single-day')}
            className="text-xs px-3 py-1.5 rounded bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] transition-colors cursor-pointer font-semibold shadow-xs"
          >
            Single-day fair
          </button>
          <button
            type="button"
            onClick={() => applyPreset('intensive')}
            className="text-xs px-3 py-1.5 rounded bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] transition-colors cursor-pointer font-semibold shadow-xs"
          >
            Heavy traffic (4 reps)
          </button>
        </div>
      </div>

      {/* Main Wizard Form Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white border border-[#d8dce0] rounded shadow-modus-2 p-6 sm:p-8 space-y-6"
      >
        {validationError && (
          <div className="p-3.5 rounded bg-[#fdf3f2] border border-[#f5b5b2] text-[#da3832] text-xs flex items-center space-x-2 font-semibold">
            <span>&bull;</span>
            <span>{validationError}</span>
          </div>
        )}

        {/* Section 1: Event Identity */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0063a3] font-mono">
            <span>1. Event Identity &amp; Location</span>
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="wizard-event-name" className="block text-xs font-semibold text-[#252a2e] mb-1.5">
                Event &amp; Booth Name <span className="text-[#da3832]">*</span>
              </label>
              <input
                id="wizard-event-name"
                type="text"
                required
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., AWS re:Invent Expo Booth #1420"
                className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3.5 py-2 text-sm text-[#252a2e] placeholder:text-[#5b6770] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="wizard-location" className="block text-xs font-semibold text-[#252a2e] mb-1.5">
                Location &amp; Booth Details
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-[#5b6770] absolute left-3.5 top-2.5" />
                <input
                  id="wizard-location"
                  type="text"
                  maxLength={200}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Venetian Expo Hall, Las Vegas, NV (Booth 1420)"
                  className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded pl-10 pr-3.5 py-2 text-sm text-[#252a2e] placeholder:text-[#5b6770] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors"
                />
              </div>
            </div>

            <div>
              <label htmlFor="wizard-timezone" className="block text-xs font-semibold text-[#252a2e] mb-1.5">
                Event Timezone
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-[#5b6770] absolute left-3.5 top-2.5" />
                <select
                  id="wizard-timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded pl-10 pr-3.5 py-2 text-sm text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors appearance-none"
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <p className="text-[11px] text-[#5b6770] mt-1">
                Defaults to your browser's timezone. Set it to the venue's.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e7eaef]" />

        {/* Section 2: Operating Schedule & Dates */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0063a3] font-mono">
            <Calendar className="w-3.5 h-3.5" />
            <span>2. Operating Dates &amp; Daily Window</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="wizard-start-date" className="block text-xs font-semibold text-[#252a2e] mb-1.5">
                Start Date
              </label>
              <input
                id="wizard-start-date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3.5 py-2 text-sm text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors font-mono"
              />
            </div>

            <div>
              <label htmlFor="wizard-end-date" className="block text-xs font-semibold text-[#252a2e] mb-1.5">
                End Date
              </label>
              <input
                id="wizard-end-date"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded px-3.5 py-2 text-sm text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="wizard-start-time" className="block text-xs font-semibold text-[#252a2e] mb-1.5">
                Daily Booth Opens (Start Time)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-[#5b6770] absolute left-3.5 top-2.5" />
                <input
                  id="wizard-start-time"
                  type="time"
                  required
                  value={dailyStartTime}
                  onChange={(e) => setDailyStartTime(e.target.value)}
                  className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded pl-10 pr-3.5 py-2 text-sm text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="wizard-end-time" className="block text-xs font-semibold text-[#252a2e] mb-1.5">
                Daily Booth Closes (End Time)
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-[#5b6770] absolute left-3.5 top-2.5" />
                <input
                  id="wizard-end-time"
                  type="time"
                  required
                  value={dailyEndTime}
                  onChange={(e) => setDailyEndTime(e.target.value)}
                  className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded pl-10 pr-3.5 py-2 text-sm text-[#252a2e] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e7eaef]" />

        {/* Section 3: Shift Architecture & Staffing Rules */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0063a3] font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>3. Shift Duration &amp; Staffing Rules</span>
          </div>

          {/* Segmented Slot Duration Toggle */}
          <div>
            <label className="block text-xs font-semibold text-[#252a2e] mb-2">
              Slot Duration (Minutes)
            </label>
            <div className="grid grid-cols-4 gap-2 bg-[#f8f9fa] p-1.5 rounded border border-[#d8dce0]">
              {([30, 60, 90, 120] as SlotDuration[]).map((dur) => {
                const isSelected = slotDurationMinutes === dur;
                return (
                  <button
                    key={dur}
                    type="button"
                    onClick={() => setSlotDurationMinutes(dur)}
                    className={cn(
                      'py-2 rounded text-xs font-mono font-semibold transition-colors cursor-pointer text-center',
                      isSelected
                        ? 'bg-[#0063a3] text-white shadow-xs'
                        : 'text-[#46535e] hover:text-[#252a2e] hover:bg-white'
                    )}
                  >
                    {dur} min
                  </button>
                );
              })}
            </div>
          </div>

          {(plan.errors.length > 0 || plan.warnings.length > 0) && (
            <ul role="status" className="space-y-1 text-xs">
              {plan.errors.map((message) => (
                <li key={message} className="font-semibold text-[#9e1b16]">
                  {message}
                </li>
              ))}
              {plan.warnings.map((message) => (
                <li key={message} className="text-[#6e4600]">
                  {message}
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Staff Capacity Stepper */}
            <div>
              <label className="block text-xs font-semibold text-[#252a2e] mb-1.5">
                Staff Needed Per Slot
              </label>
              <div className="flex items-center bg-[#f8f9fa] border border-[#d8dce0] rounded p-1">
                <button
                  type="button"
                  onClick={() => setStaffCapacityPerSlot((c) => Math.max(1, c - 1))}
                  className="p-2 rounded text-[#46535e] hover:text-[#252a2e] hover:bg-white transition-colors cursor-pointer"
                  title="Decrease capacity"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <div className="flex-1 text-center font-mono font-bold text-sm text-[#252a2e]">
                  {staffCapacityPerSlot} {staffCapacityPerSlot === 1 ? 'Rep' : 'Reps'}
                </div>
                <button
                  type="button"
                  onClick={() => setStaffCapacityPerSlot((c) => Math.min(10, c + 1))}
                  className="p-2 rounded text-[#46535e] hover:text-[#252a2e] hover:bg-white transition-colors cursor-pointer"
                  title="Increase capacity"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[11px] text-[#5b6770] mt-1">Simultaneous reps per time block</p>
            </div>

            {/* Target Hours Per Rep — now calculated automatically */}
            <div>
              <label className="block text-xs font-semibold text-[#252a2e] mb-1.5">
                Target Hours Per Rep
              </label>
              <div className="w-full bg-[#f8f9fa] border border-[#d8dce0] rounded px-3.5 py-2 text-sm text-[#46535e] flex items-center h-[38px]">
                Calculated automatically
              </div>
              <p className="text-[11px] text-[#5b6770] mt-1">
                Total required hours &divide; roster size, updated live as staff join
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-[#e7eaef]" />

        {/* Section 4: Optional Roster Quick-Paste */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#0063a3] font-mono">
              <Users className="w-3.5 h-3.5" />
              <span>4. Roster Quick-Paste (Optional)</span>
            </div>
            <span className="text-[11px] text-[#5b6770] font-mono">
              {rosterRaw.split(/[\n,]+/).filter((s) => s.trim()).length} members detected
            </span>
          </div>
          <div>
            <textarea
              rows={3}
              maxLength={5000}
              value={rosterRaw}
              onChange={(e) => setRosterRaw(e.target.value)}
              placeholder="Paste staff names (one per line or comma-separated)..."
              className="w-full bg-white border border-[#d8dce0] focus:border-[#0063a3] rounded p-3 text-xs text-[#252a2e] placeholder:text-[#5b6770] focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 transition-colors font-mono leading-relaxed"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-6 rounded bg-[#0063a3] hover:bg-[#005084] active:bg-[#003e66] text-white font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Generate event schedule</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
