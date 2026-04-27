import Link from 'next/link';
import { signOut } from 'next-auth/react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function Sidebar({ current, onChange, isAuthed, role }) {
  const isPlatformAdmin = role === 'PLATFORM_ADMIN';
  const canReadAudit = ['PLATFORM_ADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(role);
  const canUseOrganizerWorkspace = ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(role);
  const canManageStaff = ['PLATFORM_ADMIN', 'ORGANIZER_OWNER'].includes(role);
  const canManageOrganizers = role === 'PLATFORM_ADMIN';
  const { data } = useSWR(isAuthed ? '/api/notifications' : null, fetcher, { refreshInterval: 5000 });
  const unreadMessages = data?.unreadMessages || 0;

  const nav = [
    { id: 'dashboard', label: 'Tableau de bord' },
    canUseOrganizerWorkspace ? { id: 'catalogue', label: 'Catalogue' } : null,
    canUseOrganizerWorkspace || role === 'CLIENT' ? { id: 'events', label: 'Evenements' } : null,
    canUseOrganizerWorkspace || role === 'CLIENT' ? { id: 'quotes', label: 'Devis' } : null,
    canUseOrganizerWorkspace || role === 'CLIENT' ? { id: 'mockups', label: 'Maquettes' } : null,
    canUseOrganizerWorkspace ? { id: 'planning', label: 'Planning' } : null,
    canManageOrganizers ? { id: 'organizers', label: 'Organisateurs' } : null,
    isPlatformAdmin || canUseOrganizerWorkspace ? { id: 'tickets', label: isPlatformAdmin ? 'Issues' : 'Tickets' } : null,
    { id: 'chat', label: isPlatformAdmin ? 'Support organisateurs' : 'Messages' },
    { id: 'profile', label: 'Profil' },
    canManageStaff ? { id: 'staff', label: 'Equipe' } : null,
    canReadAudit ? { id: 'audit', label: 'Audit' } : null,
  ].filter(Boolean);

  return (
    <aside className="app-sidebar w-72 flex-col p-4 space-y-3 hidden md:flex">
      <Link href="/">
        <img src="../easy_event_logo.png"  className="w-28 mx-auto" />
      </Link>

      {!isAuthed ? (
        <div className="space-y-2 px-2">
          <Link href="/auth/signin" className="app-button-primary block w-full text-center py-3 rounded-2xl font-semibold">
            Connexion
          </Link>
          <Link href="/auth/signup" className="app-button-secondary block w-full text-center py-3 rounded-2xl font-semibold">
            Inscription
          </Link>
        </div>
      ) : (
        <>
          <nav className="flex flex-col space-y-1">
            {nav.map((n) => (
              <button
                key={n.id}
                onClick={() => onChange(n.id)}
                className={`sidebar-nav-button ${
                  current === n.id ? 'sidebar-nav-button-active' : ''
                }`}
              >
                <span>{n.label}</span>
                {n.id === 'chat' && unreadMessages > 0 && (
                  <span className="ml-auto min-w-[24px] px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs text-center shadow-sm">
                    {unreadMessages}
                  </span>
                )}
              </button>
            ))}
          </nav>

      
        </>
      )}
    </aside>
  );
}
