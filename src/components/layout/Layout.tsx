import React, { useEffect, useState } from 'react';
import { RefreshCw, Shield, Users, Download, History, Menu as MenuIcon } from 'lucide-react';
import { useEventStore } from '@/store/useEventStore';
import { downloadIcs, generateIcsFile } from '@/lib/calendar';
import { subscribeToConnectivity, type ConnectivityStatus } from '@/lib/firebase';
import { ToastContainer } from '@/components/common/Toast';
import { AppBackdrop } from './AppBackdrop';
import { ProfileMenu } from './ProfileMenu';

interface LayoutProps {
  children: React.ReactNode;
  headerSlot?: React.ReactNode;
  currentRoute: string;
  isAdminAuthenticated?: boolean;
  /** The signed-in admin. Shown in the profile menu at the right of the header. */
  adminEmail?: string | null;
  onSignOut?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  headerSlot,
  currentRoute,
  isAdminAuthenticated,
  adminEmail,
  onSignOut,
}) => {
  const { currentEvent: config, slots, resetToDemo } = useEventStore();
  const [connectivity, setConnectivity] = useState<ConnectivityStatus>('unknown');

  useEffect(() => {
    return subscribeToConnectivity(setConnectivity);
  }, []);

  // Staff signing up for shifts get a bare header: no way into events, the admin area or the menu.
  // An admin looking at the staff page keeps them.
  const isStaffView = currentRoute === 'staff' && !isAdminAuthenticated;
  // The expo floor is the admin shift matrix and the public staff page. Admin and Staff links belong there and nowhere else.
  const onExpoFloor = currentRoute === 'admin' || currentRoute === 'staff';
  // The shared background is for the admin side. The staff page is used on phones on the show floor and stays plain.
  const showBackdrop = currentRoute !== 'staff';
  const onMenuPage = currentRoute === 'home' || currentRoute === 'hub' || currentRoute === 'module' || currentRoute === 'users';

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
    <div className={`relative isolate text-[#252a2e] min-h-screen flex flex-col font-sans ${showBackdrop ? '' : 'bg-[#f1f3f6]'}`}>
      {showBackdrop && <AppBackdrop />}
      {/* Top Trimble Modus Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#004f83] text-white border-b border-[#003d66] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Menu and identity */}
          <div className="flex items-center space-x-1.5">
            {isAdminAuthenticated && !isStaffView && (
              <a
                href="#/"
                aria-label="Menu"
                aria-current={onMenuPage ? 'page' : undefined}
                className={`focus-ring-invert flex h-9 w-9 items-center justify-center rounded transition-colors ${
                  onMenuPage ? 'bg-white/15 text-white' : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                <MenuIcon className="w-5 h-5" aria-hidden="true" />
              </a>
            )}
            <a
              href="#/"
              className="focus-ring-invert rounded flex items-center text-white hover:opacity-95 transition-opacity"
            >
              <span className="font-bold tracking-tight text-base text-white">Showrunner</span>
            </a>

            {connectivity === 'error' && (
              <span
                role="status"
                className="inline-flex items-center space-x-1.5 rounded border border-[#f5b5b3] bg-[#fdf2f2]/90 px-2 py-0.5 text-[11px] font-semibold text-[#9e1b16]"
                title="The last attempt to reach the database failed. Changes may not be saved until connectivity is restored."
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#da3832]" aria-hidden="true" />
                <span>Connection issue</span>
              </span>
            )}
          </div>

          {/* Quick Context Navigation */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {isAdminAuthenticated && !isStaffView && (
              <>
                <a
                  href="#/events"
                  aria-current={currentRoute === 'events' ? 'page' : undefined}
                  className={`focus-ring-invert px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer ${
                    currentRoute === 'events' ? 'bg-white/15 text-white' : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Events</span>
                </a>
              </>
            )}

            {config && onExpoFloor && (
              <>
                {isAdminAuthenticated && !isStaffView && (
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
                )}

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

            {adminEmail && onSignOut && (
              <div className="ml-1 sm:ml-2">
                <ProfileMenu email={adminEmail} onSignOut={onSignOut} />
              </div>
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
            <span className="font-bold text-[#252a2e]">Showrunner</span>
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
                <span>Reset state</span>
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
