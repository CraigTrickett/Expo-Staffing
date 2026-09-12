import React, { useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Download,
  ExternalLink,
  MapPin,
  Share2,
  Shield,
  Users,
} from 'lucide-react';
import type { EventConfig, EventMetrics } from '@/types';
import { formatDate, formatTime12h } from '@/lib/utils';
import { downloadIcs, generateIcsFile } from '@/lib/calendar';
import { useBoothDutyStore } from '@/store';

interface AdminHeaderProps {
  config: EventConfig;
  metrics: EventMetrics;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({ config, metrics }) => {
  const { slots } = useBoothDutyStore();
  const [copiedType, setCopiedType] = useState<'staff' | 'admin' | null>(null);

  const staffUrl = `${window.location.origin}${window.location.pathname}#/event/${config.publicKey}`;
  const adminUrl = `${window.location.origin}${window.location.pathname}#/admin/${config.adminKey}`;

  const copyToClipboard = (text: string, type: 'staff' | 'admin') => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    }
  };

  const handleExportIcs = () => {
    const allBookings: { slot: (typeof slots)[0]; booking: (typeof slots)[0]['bookings'][0] }[] = [];
    for (const slot of slots) {
      for (const booking of slot.bookings) {
        allBookings.push({ slot, booking });
      }
    }
    const ics = generateIcsFile(config, allBookings);
    const filename = `${config.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-full-schedule.ics`;
    downloadIcs(filename, ics);
  };

  return (
    <div className="bg-white border-b border-[#d8dce0] py-4 px-4 sm:px-6 lg:px-8 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Event Details & Badges */}
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-[#fef8e8] text-[#8a5800] border border-[#f7c970]">
              <Shield className="w-3 h-3 text-[#fbad26]" />
              <span>Admin</span>
            </span>
            <span className="text-xs text-[#7c878e] font-mono">ID: {config.id}</span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#252a2e] truncate">
            {config.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[#46535e] pt-0.5">
            <span className="flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#7c878e]" />
              <span>
                {formatDate(config.startDate)} &ndash; {formatDate(config.endDate)}
              </span>
            </span>
            <span className="flex items-center space-x-1.5 font-mono">
              <span>
                {formatTime12h(config.dailyStartTime)} &ndash; {formatTime12h(config.dailyEndTime)}
              </span>
            </span>
            {config.location && (
              <span className="flex items-center space-x-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#7c878e]" />
                <span className="truncate max-w-xs">{config.location}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Sharing links and Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:self-start lg:self-center">
          {/* Public Link Share Button */}
          <button
            type="button"
            onClick={() => copyToClipboard(staffUrl, 'staff')}
            className="focus-ring px-3.5 py-2 rounded text-xs font-semibold bg-[#0063a3] hover:bg-[#005084] text-white transition-colors flex items-center space-x-2 shadow-xs cursor-pointer"
          >
            {copiedType === 'staff' ? (
              <Check className="w-3.5 h-3.5 text-white" />
            ) : (
              <Share2 className="w-3.5 h-3.5 text-white" />
            )}
            <span>{copiedType === 'staff' ? 'Link Copied!' : 'Copy Staff Link'}</span>
          </button>

          {/* Open Staff */}
          <a
            href={`#/event/${config.publicKey}`}
            className="focus-ring px-3 py-2 rounded text-xs font-semibold bg-white hover:bg-[#f1f3f6] text-[#0063a3] border border-[#0063a3] transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Open Staff</span>
            <ExternalLink className="w-3 h-3 text-[#7c878e]" />
          </a>

          {/* Export Calendar */}
          <button
            type="button"
            onClick={handleExportIcs}
            className="focus-ring px-3 py-2 rounded text-xs font-semibold bg-white hover:bg-[#f1f3f6] text-[#252a2e] border border-[#d8dce0] transition-colors flex items-center space-x-1.5 cursor-pointer"
            title="Download RFC 5545 iCalendar (.ics)"
          >
            <Download className="w-3.5 h-3.5 text-[#7c878e]" />
            <span className="hidden sm:inline">Export .ics</span>
          </button>

          {/* Admin Link backup */}
          <button
            type="button"
            onClick={() => copyToClipboard(adminUrl, 'admin')}
            className="focus-ring px-2.5 py-2 rounded text-xs font-mono text-[#46535e] hover:text-[#252a2e] bg-white border border-[#d8dce0] hover:border-[#7c878e] transition-colors flex items-center space-x-1 cursor-pointer"
            title="Copy secret Admin key link to bookmark"
          >
            {copiedType === 'admin' ? (
              <Check className="w-3 h-3 text-[#00823b]" />
            ) : (
              <Copy className="w-3 h-3 text-[#7c878e]" />
            )}
            <span className="hidden md:inline">Admin Bookmark</span>
          </button>
        </div>
      </div>
    </div>
  );
};
