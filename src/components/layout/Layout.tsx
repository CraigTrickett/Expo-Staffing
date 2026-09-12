import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  Shield,
  Users,
  Download,
  Zap,
} from 'lucide-react';
import { useEventStore } from '@/store/useEventStore';
import { downloadIcs, generateIcsFile } from '@/lib/calendar';
import { concurrencyTester } from '@/lib/supabase';
import { ToastContainer, toast } from '@/components/common/Toast';

interface LayoutProps {
  children: React.ReactNode;
  headerSlot?: React.ReactNode;
  currentRoute: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, headerSlot, currentRoute }) => {
  const { currentEvent: config, slots, resetToDemo } = useEventStore();
  const [isConflictArmed, setIsConflictArmed] = useState(false);
  const isDevMode = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

  const handleToggleSimulateConflict = () => {
    const newState = concurrencyTester.toggleSimulateConflict();
    setIsConflictArmed(newState);
    if (newState) {
      toast.warning(
        'Armed: Next shift claim will simulate a 409 concurrency conflict from another user.',
        'Concurrency Test Armed'
      );
    } else {
      toast.info('Simulated conflict disarmed.');
    }
  };

  const handleGlobalExport = () => {
    if (!config) return;
    const allBookings: { slot: (typeof slots)[0]; booking: (typeof slots)[0]['bookings'][0] }[] = [];
    for (const slot of slots) {
      for (const booking of slot.bookings) {
        allBookings.push({ slot, booking });
      }
    }
    const ics = generateIcsFile(config, allBookings);
    const filename = `${config.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-schedule.ics`;
    downloadIcs(filename, ics);
  };

  const handleReset = () => {
    if (window.confirm('Reset all schedules and roster data back to default demo state?')) {
      resetToDemo();
      window.location.hash = '#/';
    }
  };

  return (
    <div className="bg-[#f1f3f6] text-[#252a2e] min-h-screen flex flex-col font-sans">
      {/* Top Trimble Modus Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#004f83] text-white border-b border-[#003d66] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo and Identity */}
          <div className="flex items-center space-x-3">
            <a
              href="#/"
              className="focus-ring-invert rounded flex items-center text-white hover:opacity-95 transition-opacity"
            >
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="font-bold tracking-tight text-base text-white">Expo Staffing</span>
                </div>
              </div>
            </a>
          </div>

          {/* Quick Context Navigation */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <a
              href="#/"
              className={`focus-ring-invert px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer ${
                currentRoute === 'wizard'
                  ? 'bg-white text-[#004f83] shadow-xs'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Event</span>
            </a>

            {config && (
              <>
                <a
                  href={`#/admin/${config.adminKey}`}
                  className={`focus-ring-invert px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer ${
                    currentRoute === 'admin'
                      ? 'bg-[#fbad26] text-[#252a2e] shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </a>

                <a
                  href={`#/event/${config.publicKey}`}
                  className={`focus-ring-invert px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer ${
                    currentRoute === 'staff'
                      ? 'bg-white text-[#004f83] shadow-xs'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Staff</span>
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Optional Context Header Slot (e.g. AdminHeader or StaffHeader) */}
      {headerSlot}

      {/* Main Content Area */}
      <main className="flex-1 w-full">{children}</main>

      {/* Trimble Modus Footer */}
      <footer className="mt-auto border-t border-[#d8dce0] bg-white py-5 px-4 sm:px-6 lg:px-8 text-xs text-[#46535e]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#252a2e]">Expo Staffing</span>
            <span>&bull;</span>
            <span>Trimble Modus Design System</span>
            <span>&bull;</span>
            <span className="text-[#7c878e]">Zero-login link coordination</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {config && (
              <button
                type="button"
                onClick={handleGlobalExport}
                className="focus-ring rounded hover:text-[#0063a3] transition-colors flex items-center space-x-1 cursor-pointer font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export ICS</span>
              </button>
            )}

            {isDevMode && (
              <button
                type="button"
                onClick={handleToggleSimulateConflict}
                className={`focus-ring transition-colors flex items-center space-x-1.5 px-2 py-1 rounded border text-[11px] cursor-pointer font-medium ${
                  isConflictArmed
                    ? 'bg-[#fef8e8] text-[#8a5800] border-[#fbad26] animate-pulse'
                    : 'hover:text-[#0063a3] text-[#46535e] border-[#d8dce0] bg-[#f8f9fa]'
                }`}
                title="[Dev only] Toggle simulated 409 conflict: tests automatic rollback and toast warning on next shift claim"
              >
                <Zap className={`w-3.5 h-3.5 ${isConflictArmed ? 'text-[#8a5800]' : 'text-[#7c878e]'}`} />
                <span>{isConflictArmed ? '409 Conflict Armed' : 'Simulate 409 Conflict (dev)'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleReset}
              className="focus-ring rounded hover:text-[#da3832] transition-colors flex items-center space-x-1 cursor-pointer font-medium"
              title="Reset data"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Global Toast Notifications Container */}
      <ToastContainer />
    </div>
  );
};
