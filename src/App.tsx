import React, { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { CreateEventWizard } from '@/components/wizard/CreateEventWizard';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { StaffShiftPicker } from '@/components/staff/StaffShiftPicker';
import { DatabaseRequiredScreen } from '@/components/common/DatabaseRequiredScreen';
import { useEventStore } from '@/store/useEventStore';
import { isFirebaseConfigured } from '@/lib/firebase';
import { DEMO_ADMIN_KEY, DEMO_PUBLIC_KEY } from '@/lib/storage';
import { ArrowRight, Calendar, Shield, Sparkles, Users } from 'lucide-react';

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

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(parseHashRoute());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (!isFirebaseConfigured) {
    return <DatabaseRequiredScreen />;
  }

  return (
    <Layout currentRoute={route.name}>
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
                    Explore &ldquo;SaaS Disrupt Expo 2026&rdquo; Demo
                  </h3>
                  <p className="text-xs text-[#46535e] mt-0.5">
                    2 days &bull; 09:00&ndash;17:00 &bull; 2-staff capacity &bull; 6-person roster preloaded
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

          <CreateEventWizard
            onEventCreated={(adminKey) => {
              window.location.hash = `#/admin/${adminKey}`;
            }}
          />
        </div>
      )}

      {route.name === 'admin' && (
        <AdminDashboard adminKey={route.adminKey} />
      )}

      {route.name === 'staff' && (
        <StaffShiftPicker publicKey={route.publicKey} />
      )}
    </Layout>
  );
}
