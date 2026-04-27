import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

import Sidebar from '../components/Sidebar';
import Dashboard from '../components/Dashboard';
import Catalogue from '../components/Catalogue';
import Events from '../components/Events';
import Chat from '../components/Chat';
import Profile from '../components/Profile';
import StaffManagement from '../components/StaffManagement';
import AuditLog from '../components/AuditLog';
import Planning from '../components/Planning';
import Quotes from '../components/Quotes';
import Mockups from '../components/Mockups';
import OrganizerManagement from '../components/OrganizerManagement';
import Tickets from '../components/Tickets';
import UserMenu from '../components/UserMenu';
import { canManageOrganizerWorkspace } from '../lib/permissions';

export default function Home() {
  const [view, setView] = useState('dashboard');
  const [navTarget, setNavTarget] = useState(null);
  const [viewHistory, setViewHistory] = useState([]);
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const canUseOrganizerWorkspace = canManageOrganizerWorkspace(session?.user);
  const canManageStaff = ['PLATFORM_ADMIN', 'ORGANIZER_OWNER'].includes(role);
  const canManageOrganizers = role === 'PLATFORM_ADMIN';

  function navigateTo(nextView, options = {}) {
    if (!nextView || nextView === view) return;
    if (options.remember !== false) {
      setViewHistory((current) => [...current.slice(-8), view]);
    }
    setView(nextView);
    setNavTarget(options.target || null);
  }

  function goBack() {
    setViewHistory((current) => {
      const previous = current[current.length - 1] || 'dashboard';
      setView(previous);
      setNavTarget(null);
      return current.slice(0, -1);
    });
  }

  function goHome() {
    if (view !== 'dashboard') {
      setViewHistory((current) => [...current.slice(-8), view]);
    }
    setView('dashboard');
    setNavTarget(null);
  }

  useEffect(() => {
    function handleNavigate(event) {
      const nextView = event.detail?.view;
      const nextTarget = event.detail?.target || null;
      if (nextView) navigateTo(nextView, { target: nextTarget });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('easy-event:navigate', handleNavigate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('easy-event:navigate', handleNavigate);
      }
    };
  }, []);

  function handleSelectOrganizer(organizer) {
    if (typeof window !== 'undefined' && organizer?.id) {
      window.localStorage.setItem('selectedOrganizerId', String(organizer.id));
    }
    navigateTo('events');
  }

  if (status === 'loading') return <div className="p-8">Chargement…</div>;
  if (!session) {
    router.push('/auth/signin');
    return null;
  }

  return (
    <>
      <Head><title>EasyEvent</title></Head>
      <div className="app-shell flex h-screen">
        <Sidebar current={view} onChange={navigateTo} isAuthed={!!session} role={role} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="app-topbar px-4 md:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={viewHistory.length === 0}
                title="Retour"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="text-xl leading-none">&larr;</span>
              </button>
              <button
                type="button"
                onClick={goHome}
                title="Accueil"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50"
              >
                <span className="text-lg leading-none">⌂</span>
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-xl md:text-2xl font-bold app-gradient-text">EasyEvent</h1>
              <p className="hidden md:block text-sm text-slate-500">Plateforme de gestion et de reservation evenementielle</p>
            </div>
            <UserMenu />
          </div>

          <div className="app-main flex-1 overflow-y-auto p-4 md:p-8">
            {view === 'dashboard' && <Dashboard onSelectOrganizer={handleSelectOrganizer} />}
            {view === 'catalogue' && canUseOrganizerWorkspace && <Catalogue />}
            {view === 'events' && role !== 'PLATFORM_ADMIN' && <Events navTarget={navTarget} />}
            {view === 'quotes' && role !== 'PLATFORM_ADMIN' && <Quotes navTarget={navTarget} />}
            {view === 'mockups' && role !== 'PLATFORM_ADMIN' && <Mockups navTarget={navTarget} />}
            {view === 'planning' && canUseOrganizerWorkspace && <Planning />}
            {view === 'organizers' && canManageOrganizers && <OrganizerManagement />}
            {view === 'tickets' && (role === 'PLATFORM_ADMIN' || canUseOrganizerWorkspace) && <Tickets navTarget={navTarget} />}
            {view === 'profile' && <Profile />}
            {view === 'staff' && canManageStaff && <StaffManagement />}
            {view === 'audit' && ['PLATFORM_ADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(role) && <AuditLog />}
            {view === 'chat' && (
              <div className="surface-card rounded-[1.5rem] overflow-hidden h-[85vh]">
                <Chat clientId={role === 'CLIENT' ? session.user.id : undefined} />
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
