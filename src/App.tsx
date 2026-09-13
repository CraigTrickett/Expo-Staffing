import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { CreateEventWizard } from '@/components/wizard/CreateEventWizard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { StaffShiftPicker } from '@/components/staff/StaffShiftPicker';
import { DatabaseRequiredScreen } from '@/components/common/DatabaseRequiredScreen';
import { useEventStore } from '@/store/useEventStore';
import { isFirebaseConfigured, subscribeToAdminAuth, fetchEventByKey } from '@/lib/firebase';
import { DEMO_ADMIN_KEY, DEMO_PUBLIC_KEY } from '@/lib/storage';
import { formatDate } from '@/lib/utils';
import { ArrowRight, Calendar, Loader2, Shield, Sparkles, Users } from 'lucide-react';

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
  const { currentEvent } = useEventStore();
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [demoStats, setDemoStats] = useState<{
    title: string;
    startDate: string;
    endDate: string;
    dailyStartTime: string;
    dailyEndTime: string;
    staffCapacityPerSlot: number;
    rosterCount: number;
  } | null>(null);
  const [demoStatsFailed, setDemoStatsFailed] = useState(false);

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

  // The demo banner's stats must reflect the demo event's actual current
  // state, not a fixed description — an admin can (and did, during
  // testing) change its capacity or roster after creation, which would
  // otherwise leave the landing page showing numbers that are no longer
  // true.
  useEffect(() => {
    if (route.name !== 'wizard') return;
    let cancelled = false;

    fetchEventByKey(DEMO_ADMIN_KEY)
      .then((result) => {
        if (cancelled || !result) return;
        const { config, roster } = result.data;
        setDemoStats({
          title: config.title,
          startDate: config.startDate,
          endDate: config.endDate,
          dailyStartTime: config.dailyStartTime,
          dailyEndTime: config.dailyEndTime,
          staffCapacityPerSlot: config.staffCapacityPerSlot,
          rosterCount: roster.length,
        });
      })
      .catch(() => {
        if (!cancelled) setDemoStatsFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [route.name]);

  if (!isFirebaseConfigured) {
    return <DatabaseRequiredScreen />;
  }

  return (
    <Layout currentRoute={route.name} isAdminAuthenticated={Boolean(adminEmail)}>
      {route.name === 'wizard' && (
        <div className="space-y-6">
          {/* Quick Demo Event Launcher Banner */}
          <div className="max-w-3xl mx-auto mt-6 px-4">
            <div className="bg-white border border-[#d8dce0] rounded shadow-xs p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded bg-[#e5f2f8] text-[#0063a3] border border-[#b9dcf0]">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#0063a3]">
                      Live Demonstration
                    </span>
                    <span className="text-[11px] bg-[#e6f5ec] text-[#00823b] border border-[#a3d8b9] px-2 py-0.2 rounded font-semibold">
                      Ready to Test
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#252a2e] mt-0.5">
                    Explore &ldquo;{demoStats?.title || 'SaaS Disrupt Expo 2026'}&rdquo; Demo
                  </h3>
                  <p className="text-xs text-[#46535e] mt-0.5">
                    {demoStats ? (
                      <>
                        {formatDate(demoStats.startDate)} &ndash; {formatDate(demoStats.endDate)} &bull;{' '}
                        {demoStats.dailyStartTime}&ndash;{demoStats.dailyEndTime} &bull;{' '}
                        {demoStats.staffCapacityPerSlot}-staff capacity &bull; {demoStats.rosterCount}-person roster
                      </>
                    ) : demoStatsFailed ? (
                      'Details unavailable right now — the demo event still works, this is just a display issue.'
                    ) : (
                      'Loading current demo details...'
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <a
                  href={`#/admin/${DEMO_ADMIN_KEY}`}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-[#0063a3] hover:bg-[#005084] text-white rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-xs"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </a>
                <a
                  href={`#/event/${DEMO_PUBLIC_KEY}`}
                  className="flex-1 sm:flex-initial px-4 py-2 bg-white hover:bg-[#f1f3f6] text-[#0063a3] border border-[#0063a3] rounded text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Staff</span>
                </a>
              </div>
            </div>
          </div>

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
