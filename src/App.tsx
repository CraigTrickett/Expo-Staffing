import React, { Suspense, lazy, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { DatabaseRequiredScreen } from '@/components/common/DatabaseRequiredScreen';
import { NotFoundPage } from '@/components/common/NotFoundPage';
import { PageSpinner } from '@/components/common/PageSpinner';
import { AccessCheckFailed } from '@/components/common/AccessCheckFailed';
import { ensurePublicLinks, isFirebaseConfigured, retryAdminCheck, subscribeToAdminAuth, signOutAdmin } from '@/lib/firebase';
import type { AdminAuthStatus } from '@/lib/firebase';
import { hrefs, isAdminOnlyRoute, parseRoute } from '@/lib/route';
import type { Route } from '@/lib/route';

// Pages load when they are first visited, so the staff page, for example, does not carry the admin screens.
const HubPage = lazy(() => import('@/components/home/HubPage').then((m) => ({ default: m.HubPage })));
const EventsPage = lazy(() => import('@/components/home/EventsPage').then((m) => ({ default: m.EventsPage })));
const ModulePage = lazy(() => import('@/components/admin/ModulePage').then((m) => ({ default: m.ModulePage })));
const UserManagerPage = lazy(() => import('@/components/admin/UserManagerPage').then((m) => ({ default: m.UserManagerPage })));
const CreateEventWizard = lazy(() => import('@/components/wizard/CreateEventWizard').then((m) => ({ default: m.CreateEventWizard })));
const AdminDashboard = lazy(() => import('@/components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const StaffShiftPicker = lazy(() => import('@/components/staff/StaffShiftPicker').then((m) => ({ default: m.StaffShiftPicker })));

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authStatus, setAuthStatus] = useState<AdminAuthStatus>('signed_out');

  useEffect(() => {
    const handleHashChange = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToAdminAuth((email, status) => {
      setAdminEmail(email);
      setAuthStatus(status);
      setAuthReady(true);
    });
    return () => unsubscribe?.();
  }, []);

  // Staff open an event through a lookup entry that is created with the event. Events made before that
  // existed get theirs the first time an admin signs in, so their staff links keep working.
  useEffect(() => {
    if (adminEmail) void ensurePublicLinks();
  }, [adminEmail]);

  if (!isFirebaseConfigured) {
    return <DatabaseRequiredScreen />;
  }

  // The menu, its pages and the create page are for signed-in admins. The staff page is open to anyone with its link.
  const needsAdmin = isAdminOnlyRoute(route);

  return (
    <Layout currentRoute={route.name} isAdminAuthenticated={Boolean(adminEmail)} adminEmail={adminEmail} onSignOut={() => signOutAdmin()}>
      {(needsAdmin || route.name === 'admin') && !authReady && <PageSpinner />}

      {/* Signed in, but access could not be checked: say so, rather than showing a sign-in form they have already used. */}
      {(needsAdmin || route.name === 'admin') && authReady && !adminEmail && authStatus === 'error' && <AccessCheckFailed onRetry={retryAdminCheck} />}

      {(needsAdmin || route.name === 'admin') && authReady && !adminEmail && authStatus !== 'error' && <AdminLogin />}

      <Suspense fallback={<PageSpinner />}>
        {needsAdmin && authReady && adminEmail && (
          <>
            {route.name === 'home' && <HubPage />}
            {route.name === 'hub' && <HubPage eventId={route.eventId} />}
            {route.name === 'module' && <ModulePage eventId={route.eventId} moduleId={route.moduleId} />}
            {route.name === 'users' && <UserManagerPage currentEmail={adminEmail} />}
            {route.name === 'events' && <EventsPage />}
            {route.name === 'new' && (
              <div className="space-y-6">
                <div className="max-w-3xl mx-auto px-4 pt-6 text-xs">
                  <a
                    href={hrefs.home}
                    className="focus-ring inline-flex items-center space-x-1.5 px-2.5 py-1.5 -ml-2.5 rounded text-xs font-semibold text-[#46535e] hover:text-[#0063a3] hover:bg-[#e5f2f8] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to menu</span>
                  </a>
                </div>
                <CreateEventWizard
                  onEventCreated={(adminKey) => {
                    window.location.hash = hrefs.admin(adminKey);
                  }}
                />
              </div>
            )}
          </>
        )}

        {route.name === 'admin' && authReady && adminEmail && <AdminDashboard adminKey={route.adminKey} />}

        {route.name === 'staff' && <StaffShiftPicker publicKey={route.publicKey} />}
      </Suspense>

      {route.name === 'notfound' && <NotFoundPage />}
    </Layout>
  );
}
