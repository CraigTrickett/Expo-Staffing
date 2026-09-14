import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { CreateEventWizard } from '@/components/wizard/CreateEventWizard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { StaffShiftPicker } from '@/components/staff/StaffShiftPicker';
import { MyEventsPanel } from '@/components/common/MyEventsPanel';
import { DatabaseRequiredScreen } from '@/components/common/DatabaseRequiredScreen';
import { isFirebaseConfigured, subscribeToAdminAuth, signOutAdmin } from '@/lib/firebase';
import { History, Loader2 } from 'lucide-react';

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
  const [showMyEvents, setShowMyEvents] = useState(false);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHashRoute());
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

  if (!isFirebaseConfigured) {
    return <DatabaseRequiredScreen />;
  }

  return (
    <Layout currentRoute={route.name} isAdminAuthenticated={Boolean(adminEmail)}>
      {route.name === 'wizard' && (
        <div className="space-y-6">
          {adminEmail && (
            <div className="max-w-3xl mx-auto px-4 pt-6 flex items-center justify-between text-xs text-[#46535e]">
              <span>
                Signed in as <span className="font-semibold text-[#252a2e]">{adminEmail}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMyEvents(true)}
                  className="focus-ring inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#0063a3] border border-[#d8dce0] hover:border-[#0063a3] bg-white transition-colors cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>All Events</span>
                </button>
                <button
                  type="button"
                  onClick={() => signOutAdmin()}
                  className="focus-ring inline-flex items-center space-x-1.5 px-2.5 py-1.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#da3832] border border-[#d8dce0] hover:border-[#f5b5b3] bg-white transition-colors cursor-pointer"
                >
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}

          {!authReady ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-[#0063a3]" />
            </div>
          ) : adminEmail ? (
            <CreateEventWizard
              onEventCreated={(adminKey) => {
                window.location.hash = `#/admin/${adminKey}`;
              }}
            />
          ) : (
            <AdminLogin />
          )}

          {showMyEvents && <MyEventsPanel onClose={() => setShowMyEvents(false)} />}
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
    </Layout>
  );
}
