import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  Shield,
  Users,
  Download,
} from 'lucide-react';
import { useEventStore } from '@/store/useEventStore';
import { downloadIcs, generateIcsFile } from '@/lib/calendar';
import { subscribeToConnectivity, type ConnectivityStatus } from '@/lib/firebase';
import { ToastContainer } from '@/components/common/Toast';

interface LayoutProps {
  children: React.ReactNode;
  headerSlot?: React.ReactNode;
  currentRoute: string;
  isAdminAuthenticated?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({ children, headerSlot, currentRoute, isAdminAuthenticated }) => {
  const { currentEvent: config, slots, resetToDemo } = useEventStore();
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>('unknown');

  useEffect(() => {
    return subscribeToConnectivity(setConnectivity);
  }, []);

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

            <span
              className={`hidden sm:inline-flex items-center space-x-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                connectivity === 'error'
                  ? 'bg-[#fdf2f2]/90 border-[#f5b5b3] text-[#fdecec]'
                  : 'bg-white/10 border-white/20 text-white'
              }`}
              title={
                connectivity === 'connected'
                  ? 'The database responded successfully just now — data syncs across devices.'
                  : connectivity === 'error'
                    ? 'The last attempt to reach the database failed. Changes may not be saved until connectivity is restored.'
                    : 'Not yet confirmed whether the database is reachable in this session.'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  connectivity === 'connected'
                    ? 'bg-[#4ade80]'
                    : connectivity === 'error'
                      ? 'bg-[#da3832]'
                      : 'bg-white/40'
                }`}
              />
              <span>
                {connectivity === 'connected' ? 'Synced' : connectivity === 'error' ? 'Connection Issue' : 'Connecting...'}
              </span>
            </span>
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

            {isAdminAuthenticated && (
              <button
                type="button"
                onClick={handleReset}
                className="focus-ring rounded hover:text-[#da3832] transition-colors flex items-center space-x-1 cursor-pointer font-medium"
                title="Reset data"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset State</span>
              </button>
            )}
          </div>
        </div>
      </footer>

      {/* Global Toast Notifications Container */}
      <ToastContainer />
    </div>
  );
};
