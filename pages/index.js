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
  const { data: session, status } = useSession();
  const router = useRouter();
  const role = session?.user?.role;
  const canUseOrganizerWorkspace = canManageOrganizerWorkspace(session?.user);
  const canManageStaff = ['PLATFORM_ADMIN', 'ORGANIZER_OWNER'].includes(role);
  const canManageOrganizers = role === 'PLATFORM_ADMIN';

  useEffect(() => {
    function handleNavigate(event) {
      const nextView = event.detail?.view;
      if (nextView) setView(nextView);
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
    setView('events');
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
        <Sidebar current={view} onChange={setView} isAuthed={!!session} role={role} />
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="app-topbar px-4 md:px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-bold app-gradient-text">EasyEvent</h1>
              <p className="hidden md:block text-sm text-slate-500">Plateforme de gestion et de reservation evenementielle</p>
            </div>
            <UserMenu />
          </div>

          <div className="app-main flex-1 overflow-y-auto p-4 md:p-8">
            {view === 'dashboard' && <Dashboard onSelectOrganizer={handleSelectOrganizer} />}
            {view === 'catalogue' && canUseOrganizerWorkspace && <Catalogue />}
            {view === 'events' && role !== 'PLATFORM_ADMIN' && <Events />}
            {view === 'quotes' && role !== 'PLATFORM_ADMIN' && <Quotes />}
            {view === 'mockups' && role !== 'PLATFORM_ADMIN' && <Mockups />}
            {view === 'planning' && canUseOrganizerWorkspace && <Planning />}
            {view === 'organizers' && canManageOrganizers && <OrganizerManagement />}
            {view === 'tickets' && (role === 'PLATFORM_ADMIN' || canUseOrganizerWorkspace) && <Tickets />}
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
