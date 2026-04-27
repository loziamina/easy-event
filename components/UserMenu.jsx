import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { signOut, useSession } from 'next-auth/react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

function initials(name, email) {
  const base = (name || email || 'U').trim();
  const parts = base.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
}

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 72, right: 16 });
  const [notificationsPosition, setNotificationsPosition] = useState({ top: 72, right: 76 });
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const notificationsRef = useRef(null);
  const notificationsButtonRef = useRef(null);
  const avatarUrl = session?.user?.avatarUrl || '';
  const { data: notificationsData, mutate: mutateNotifications } = useSWR(session ? '/api/notifications' : null, fetcher, { refreshInterval: 5000 });
  const notifications = notificationsData?.notifications || [];
  const unreadNotifications = notificationsData?.unreadNotifications || 0;

  useEffect(() => {
    setMounted(true);

    function handleClick(event) {
      const clickedButton = wrapperRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);
      const clickedNotifications = notificationsRef.current?.contains(event.target);
      if (!clickedButton && !clickedMenu && !clickedNotifications) {
        setOpen(false);
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function goToProfile() {
    setOpen(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('easy-event:navigate', { detail: { view: 'profile' } }));
    }
  }

  function toggleMenu() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 12,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    setNotificationsOpen(false);
    setOpen((current) => !current);
  }

  function toggleNotifications() {
    if (notificationsButtonRef.current) {
      const rect = notificationsButtonRef.current.getBoundingClientRect();
      setNotificationsPosition({
        top: rect.bottom + 12,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    setOpen(false);
    setNotificationsOpen((current) => !current);
  }

  async function markNotificationsRead() {
    await fetch('/api/notifications', { method: 'PATCH' });
    mutateNotifications();
  }

  return (
    <div ref={wrapperRef} className="flex items-center gap-3">
      <button
        ref={notificationsButtonRef}
        type="button"
        onClick={toggleNotifications}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white/90 text-slate-700 shadow-sm hover:border-indigo-200 hover:bg-indigo-50"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {unreadNotifications > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-[22px] rounded-full bg-rose-500 px-1.5 py-0.5 text-center text-xs font-bold text-white shadow-sm">
            {unreadNotifications}
          </span>
        ) : null}
      </button>

      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/90 px-2 py-2 shadow-sm hover:border-slate-300"
      >
        <div className="h-11 w-11 overflow-hidden rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            initials(session?.user?.name, session?.user?.email)
          )}
        </div>
      </button>

      {mounted && open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[2147483647] w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
          style={{ top: menuPosition.top, right: menuPosition.right }}
        >
          <div className="px-3 py-3 border-b border-slate-100">
            <p className="font-semibold text-slate-900">{session?.user?.name || 'Mon compte'}</p>
            <p className="text-sm text-slate-500 truncate">{session?.user?.email || ''}</p>
          </div>
          <button onClick={goToProfile} className="w-full text-left px-3 py-3 rounded-xl text-slate-700 hover:bg-slate-50">
            Profil
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="w-full text-left px-3 py-3 rounded-xl text-rose-600 hover:bg-rose-50"
          >
            Deconnexion
          </button>
        </div>,
        document.body
      )}

      {mounted && notificationsOpen && createPortal(
        <div
          ref={notificationsRef}
          className="fixed z-[2147483647] w-80 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
          style={{ top: notificationsPosition.top, right: notificationsPosition.right }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-2 pb-3">
            <div>
              <p className="font-semibold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">{unreadNotifications} non lue(s)</p>
            </div>
            {unreadNotifications > 0 ? (
              <button type="button" onClick={markNotificationsRead} className="text-xs font-semibold text-indigo-700 hover:text-indigo-900">
                Tout lire
              </button>
            ) : null}
          </div>

          <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-sm">
                <p className="font-semibold text-slate-900">{notification.title}</p>
                {notification.body ? <p className="mt-1 text-slate-600">{notification.body}</p> : null}
                <p className="mt-2 text-xs text-slate-400">{new Date(notification.createdAt).toLocaleString('fr-FR')}</p>
              </div>
            ))}
            {notifications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Aucune notification pour le moment.
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
