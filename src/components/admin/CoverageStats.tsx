import React from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Globe,
  Minus,
  Pencil,
  Plus,
  Share2,
  Users,
} from 'lucide-react';
import type { EventConfig, EventMetrics, StaffMember } from '@/types';
import { cn, getTimezoneOptions } from '@/lib/utils';
import { downloadEventIcs } from '@/lib/calendar';
import { toast } from '@/components/common/Toast';

interface CoverageStatsProps {
  config: EventConfig;
  metrics: EventMetrics;
  roster: StaffMember[];
  onOpenZeroHoursDrawer: () => void;
  zeroHoursCount: number;
  onOpenShareModal?: () => void;
  onUpdateDefaultCapacity?: (newCapacity: number) => void;
  onUpdateTimezone?: (newTimezone: string) => void;
  onUpdateEventDetails?: (updates: { title: string; location: string }) => void;
}

export const CoverageStats: React.FC<CoverageStatsProps> = ({
  config,
  metrics,
  roster,
  onOpenZeroHoursDrawer,
  zeroHoursCount,
  onOpenShareModal,
  onUpdateDefaultCapacity,
  onUpdateTimezone,
  onUpdateEventDetails,
}) => {
  const [copied, setCopied] = React.useState(false);
  const timezoneOptions = React.useMemo(() => getTimezoneOptions(), []);
  const [isEditingDetails, setIsEditingDetails] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState(config.title);
  const [editLocation, setEditLocation] = React.useState(config.location);

  const percent = Math.min(100, Math.max(0, metrics.overallCoveragePercent));
  const isOptimal = percent >= 90;

  // SVG Circular Gauge calculations
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  const publicUrl = `${window.location.origin}${window.location.pathname}#/event/${config.publicKey}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportIcs = () => {
    // Generate .ics calendar for all scheduled shifts
    downloadEventIcs(config, []);
  };

  return (
    <div className="bg-white border border-[#d8dce0] rounded p-5 shadow-xs space-y-4">
      {/* Top row: Event Identity & Share Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#d8dce0] pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#fef8e8] text-[#8a5800] border border-[#f7c970] uppercase tracking-wider">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {isEditingDetails ? (
              <input
                type="text"
                maxLength={150}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                className="text-xl sm:text-2xl font-bold text-[#252a2e] tracking-tight bg-white border border-[#0063a3] rounded px-2 py-0.5 focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 w-full max-w-md"
              />
            ) : (
              <h1 className="text-xl sm:text-2xl font-bold text-[#252a2e] tracking-tight">
                {config.title}
              </h1>
            )}
            {onUpdateEventDetails && !isEditingDetails && (
              <button
                type="button"
                onClick={() => {
                  setEditTitle(config.title);
                  setEditLocation(config.location);
                  setIsEditingDetails(true);
                }}
                className="focus-ring p-1 text-[#7c878e] hover:text-[#0063a3] hover:bg-[#e5f2f8] rounded transition-colors cursor-pointer shrink-0"
                title="Edit event name and location"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {isEditingDetails ? (
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="text"
                maxLength={200}
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                placeholder="Location & booth details"
                className="text-xs text-[#252a2e] bg-white border border-[#0063a3] rounded px-2 py-1 focus:outline-hidden focus:ring-2 focus:ring-[#0063a3]/25 w-full max-w-sm placeholder:text-[#7c878e]"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmedTitle = editTitle.trim();
                  if (!trimmedTitle) {
                    toast.error('Event name cannot be blank.', 'Invalid Name');
                    return;
                  }
                  onUpdateEventDetails?.({ title: trimmedTitle, location: editLocation.trim() });
                  setIsEditingDetails(false);
                }}
                className="px-2.5 py-1 bg-[#0063a3] hover:bg-[#005084] text-white rounded text-[11px] font-semibold cursor-pointer shrink-0"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsEditingDetails(false)}
                className="px-2.5 py-1 bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] rounded text-[11px] cursor-pointer shrink-0"
              >
                Cancel
              </button>
            </div>
          ) : (
            <p className="text-xs text-[#46535e] mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span>{config.location}</span>
              <span>&bull;</span>
              <span>{config.startDate} to {config.endDate}</span>
              <span>&bull;</span>
              <span>{config.dailyStartTime} - {config.dailyEndTime} ({config.slotDurationMinutes}m shifts)</span>
            </p>
          )}
        </div>

        {/* Public invite link bar */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-[#f8f9fa] border border-[#d8dce0] rounded px-3 py-1.5 text-xs font-mono text-[#252a2e] max-w-xs truncate shadow-xs">
            <Share2 className="w-3.5 h-3.5 text-[#0063a3] mr-2 shrink-0" />
            <span className="truncate text-[#46535e]">#/event/{config.publicKey}</span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="focus-ring flex items-center space-x-1.5 px-3 py-2 bg-[#0063a3] hover:bg-[#005084] text-white rounded text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Copy Public Signup Link to share with staff"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copied ? 'Copied!' : 'Copy Staff Link'}</span>
          </button>
          {onOpenShareModal && (
            <button
              type="button"
              onClick={onOpenShareModal}
              className="focus-ring flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-[#f1f3f6] text-[#0063a3] border border-[#0063a3] rounded text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              title="Open the share modal with QR code and admin link"
            >
              <Share2 className="w-3.5 h-3.5 text-[#0063a3]" />
              <span>Share &amp; QR</span>
            </button>
          )}
          <a
            href={`#/event/${config.publicKey}`}
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring p-2 bg-white hover:bg-[#f1f3f6] text-[#46535e] hover:text-[#252a2e] border border-[#d8dce0] rounded text-xs transition-colors shadow-xs"
            title="Preview Staff Shift Picker in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Main Metrics Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Live Coverage Ring */}
        <div className="bg-[#f8f9fa] border border-[#d8dce0] rounded p-4 flex items-center space-x-4 shadow-xs">
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
              {/* Background circle */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-[#d8dce0]"
                strokeWidth="7"
                fill="transparent"
              />
              {/* Progress circle */}
              <circle
                cx="40"
                cy="40"
                r={radius}
                className={cn(
                  'transition-all duration-700 ease-out',
                  isOptimal ? 'stroke-[#00823b]' : 'stroke-[#fbad26]'
                )}
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className={cn(
                'text-lg font-bold font-mono tracking-tight',
                isOptimal ? 'text-[#00823b]' : 'text-[#8a5800]'
              )}>
                {percent}%
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-[#46535e] uppercase tracking-wider">
              Coverage Level
            </div>
            <div className={cn('text-sm font-semibold mt-0.5', isOptimal ? 'text-[#00823b]' : 'text-[#8a5800]')}>
              {isOptimal ? 'Target Achieved (>= 90%)' : 'Needs Coverage (< 90%)'}
            </div>
            <p className="text-[11px] text-[#7c878e] mt-1">
              {metrics.understaffedSlotCount > 0
                ? `${metrics.understaffedSlotCount} slots need staffing`
                : 'All slots fully staffed!'}
            </p>
          </div>
        </div>

        {/* Metric 2: Scheduled vs Required Hours */}
        <div className="bg-[#f8f9fa] border border-[#d8dce0] rounded p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#46535e] text-xs font-semibold uppercase tracking-wider">
            <span>Staff Hours</span>
            <Clock className="w-3.5 h-3.5 text-[#7c878e]" />
          </div>
          <div className="my-2">
            <div className="flex items-baseline space-x-1.5 font-mono">
              <span className="text-2xl font-bold text-[#252a2e]">
                {metrics.totalBookedHours}
              </span>
              <span className="text-xs text-[#7c878e] font-sans">
                / {metrics.totalCapacityHours} hrs req.
              </span>
            </div>
            {/* Linear meter */}
            <div className="w-full bg-[#d8dce0] h-2 rounded-full mt-2 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all duration-500 rounded-full',
                  isOptimal ? 'bg-[#00823b]' : 'bg-[#fbad26]'
                )}
                style={{ width: `${Math.min(100, (metrics.totalBookedHours / Math.max(1, metrics.totalCapacityHours)) * 100)}%` }}
              />
            </div>
          </div>
          <div className="text-[11px] text-[#7c878e]">
            {Math.max(0, Math.round((metrics.totalCapacityHours - metrics.totalBookedHours) * 10) / 10)} hours remaining
          </div>
        </div>

        {/* Metric 3: Uncommitted Staff Alert */}
        <div className={cn(
          'rounded p-4 flex flex-col justify-between border transition-all shadow-xs',
          zeroHoursCount > 0
            ? 'bg-[#fef8e8] border-[#f7c970]'
            : 'bg-[#f8f9fa] border-[#d8dce0]'
        )}>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider">
            <span className={zeroHoursCount > 0 ? 'text-[#8a5800]' : 'text-[#46535e]'}>
              Uncommitted Staff
            </span>
            {zeroHoursCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-[#fbad26]" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#00823b]" />
            )}
          </div>
          <div className="my-1">
            <div className="flex items-baseline space-x-2 font-mono">
              <span className={cn(
                'text-2xl font-bold',
                zeroHoursCount > 0 ? 'text-[#8a5800]' : 'text-[#00823b]'
              )}>
                {zeroHoursCount}
              </span>
              <span className="text-xs text-[#7c878e] font-sans">
                of {roster.length} members with 0 hrs
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenZeroHoursDrawer}
            className={cn(
              'focus-ring w-full py-1.5 px-2.5 rounded text-xs font-semibold flex items-center justify-center space-x-1 transition-colors cursor-pointer',
              zeroHoursCount > 0
                ? 'bg-[#fbad26] hover:bg-[#e49b1e] text-[#252a2e] font-bold shadow-xs'
                : 'bg-white hover:bg-[#f1f3f6] text-[#46535e] border border-[#d8dce0]'
            )}
          >
            <span>{zeroHoursCount > 0 ? 'View Uncommitted Staff' : 'All Staff Committed'}</span>
          </button>
        </div>

        {/* Metric 4: Total Slots & Quick Stats */}
        <div className="bg-[#f8f9fa] border border-[#d8dce0] rounded p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between text-[#46535e] text-xs font-semibold uppercase tracking-wider">
            <span>Roster &amp; Capacity</span>
            <Users className="w-3.5 h-3.5 text-[#7c878e]" />
          </div>
          <div className="my-1 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#46535e]">Total Shift Slots:</span>
              <span className="font-mono font-semibold text-[#252a2e]">{metrics.totalSlots} slots</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#46535e]">Roster Headcount:</span>
              <span className="font-mono font-semibold text-[#252a2e]">{roster.length} staff</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#46535e]">Slot Capacity:</span>
              {onUpdateDefaultCapacity ? (
                <div className="flex items-center bg-white border border-[#d8dce0] rounded">
                  <button
                    type="button"
                    onClick={() => onUpdateDefaultCapacity(config.staffCapacityPerSlot - 1)}
                    disabled={config.staffCapacityPerSlot <= 1}
                    className="focus-ring p-1 text-[#46535e] hover:text-[#252a2e] hover:bg-[#f1f3f6] disabled:opacity-40 disabled:cursor-not-allowed rounded-l cursor-pointer transition-colors"
                    title="Decrease default slot capacity"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono font-semibold text-[#252a2e] px-1.5 min-w-[3.5rem] text-center">
                    {config.staffCapacityPerSlot} staff/shift
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateDefaultCapacity(config.staffCapacityPerSlot + 1)}
                    disabled={config.staffCapacityPerSlot >= 10}
                    className="focus-ring p-1 text-[#46535e] hover:text-[#252a2e] hover:bg-[#f1f3f6] disabled:opacity-40 disabled:cursor-not-allowed rounded-r cursor-pointer transition-colors"
                    title="Increase default slot capacity"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <span className="font-mono font-semibold text-[#252a2e]">{config.staffCapacityPerSlot} staff/shift</span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#46535e] flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Timezone:
              </span>
              {onUpdateTimezone ? (
                <select
                  value={config.timezone}
                  onChange={(e) => onUpdateTimezone(e.target.value)}
                  className="focus-ring bg-white border border-[#d8dce0] rounded text-xs font-mono font-semibold text-[#252a2e] py-1 pl-2 pr-1 max-w-[220px] cursor-pointer"
                  title="Correct this if it doesn't match the actual venue's timezone"
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-mono font-semibold text-[#252a2e]">{config.timezone}</span>
              )}
            </div>
          </div>
          <div className="text-[11px] text-[#7c878e]">
            Target: {metrics.dynamicTargetHours}h per rep &bull; calculated from roster &amp; slots
          </div>
        </div>
      </div>
    </div>
  );
};
