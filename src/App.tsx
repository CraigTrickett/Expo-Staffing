import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { CreateEventWizard } from '@/components/wizard/CreateEventWizard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { StaffShiftPicker } from '@/components/staff/StaffShiftPicker';
import { MyEventsPanel } from '@/components/common/MyEventsPanel';
import { DatabaseRequiredScreen } from '@/components/common/DatabaseRequiredScreen';
import { isFirebaseConfigured, subscribeToAdminAuth, signOutAdmin } from '@/lib/firebase';
import { useEventStore } from '@/store/useEventStore';
import type { EventConfig } from '@/types';
import { History, Loader2, Shield } from 'lucide-react';

type RouteState =
  | { name: 'wizard' }
  | { name: 'admin'; adminKey: string }
  | { name: 'staff'; publicKey: string };

function parseHashRoute(): RouteState {
  const hash = window.location.hash || '';

  if (hash.startsWith('#/admin/')) {
    const adminKey = hash.replace('#/admin/', '').trim();
    return { name: 'admin', adminKey };
  }

  if (hash.startsWith('#/event/')) {
    const publicKey = hash.replace('#/event/', '').trim();
    return { name: 'staff', publicKey };
  }

  return { name: 'wizard' };
}

export default function App() {
  const [route, setRoute] = useState<RouteState>(parseHashRoute());
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const { currentEvent } = useEventStore();

  // Selected event for opening the Admin Hub directly (e.g. from Menu button)
  const [selectedHubEvent, setSelectedHubEvent] = useState<EventConfig | null>(null);

  // When first accessing the site (no specific event deep link), open the Events modal by default
  const [showAllEvents, setShowAllEvents] = useState<boolean>(() => {
    const hash = window.location.hash || '';
    return !hash.startsWith('#/admin/') && !hash.startsWith('#/event/');
  });

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = parseHashRoute();
      setRoute(nextRoute);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAdminAuth((email) => {
      setAdminEmail(email);
      setAuthReady(true);
    });
    return () => unsubscribe?.();
  }, []);

  const handleOpenMenu = () => {
    if (currentEvent) {
      setSelectedHubEvent(currentEvent);
    } else {
      setSelectedHubEvent(null);
    }
    setShowAllEvents(true);
  };

  const handleOpenEvents = () => {
    setSelectedHubEvent(null);
    setShowAllEvents(true);
  };

  if (!isFirebaseConfigured) {
    return <DatabaseRequiredScreen />;
  }

  return (
    <Layout
      currentRoute={route.name}
      isAdminAuthenticated={Boolean(adminEmail)}
      onOpenAllEvents={handleOpenEvents}
      onOpenMenu={handleOpenMenu}
    >
      {route.name === 'wizard' && (
        <div className="space-y-6">
          <div className="max-w-3xl mx-auto px-4 pt-6 flex items-center justify-between text-xs text-[#46535e]">
            {adminEmail ? (
              <span>
                Signed in as <span className="font-semibold text-[#252a2e]">{adminEmail}</span>
              </span>
            ) : (
              <span className="text-[#7c878e]">
                Expo Staffing Workspace
              </span>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenEvents}
                className="focus-ring inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#0063a3] border border-[#d8dce0] hover:border-[#0063a3] bg-white transition-colors cursor-pointer shadow-2xs"
              >
                <History className="w-3.5 h-3.5" />
                <span>Events</span>
              </button>

              {adminEmail ? (
                <button
                  type="button"
                  onClick={() => signOutAdmin()}
                  className="focus-ring inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#da3832] border border-[#d8dce0] hover:border-[#f5b5b3] bg-white transition-colors cursor-pointer shadow-2xs"
                >
                  <span>Log Out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAdminLoginModal(true)}
                  className="focus-ring inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-semibold text-[#0063a3] hover:text-[#005084] border border-[#b9dcf0] hover:border-[#0063a3] bg-[#e5f2f8] transition-colors cursor-pointer shadow-2xs"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin Sign In</span>
                </button>
              )}
            </div>
          </div>

          {!authReady ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-[#0063a3]" />
            </div>
          ) : (
            <CreateEventWizard
              onEventCreated={(adminKey) => {
                window.location.hash = `#/admin/${adminKey}`;
              }}
            />
          )}

          {showAdminLoginModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#252a2e]/60 backdrop-blur-xs animate-in fade-in duration-150">
              <div className="relative w-full max-w-sm">
                <button
                  type="button"
                  onClick={() => setShowAdminLoginModal(false)}
                  className="absolute right-3 top-3 z-10 p-1 rounded-full text-[#7c878e] hover:text-[#252a2e] hover:bg-[#f1f3f6]"
                  aria-label="Close"
                >
                  &times;
                </button>
                <AdminLogin />
              </div>
            </div>
          )}
        </div>
      )}

      {route.name === 'admin' && (
        <>
          {!authReady ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-[#0063a3]" />
            </div>
          ) : adminEmail ? (
            <AdminDashboard adminKey={route.adminKey} adminEmail={adminEmail} />
          ) : (
            <AdminLogin />
          )}
        </>
      )}

      {route.name === 'staff' && (
        <StaffShiftPicker publicKey={route.publicKey} />
      )}

      {/* Global Events & Admin Hub Modal Flow */}
      {showAllEvents && (
        <MyEventsPanel
          initialEventForHub={selectedHubEvent}
          onClose={() => {
            setShowAllEvents(false);
            setSelectedHubEvent(null);
          }}
          onCreateNew={() => {
            setShowAllEvents(false);
            setSelectedHubEvent(null);
          }}
        />
      )}
    </Layout>
  );
}
