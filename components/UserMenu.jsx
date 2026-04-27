import { useEffect, useRef, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';

function initials(name, email) {
  const base = (name || email || 'U').trim();
  const parts = base.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
}

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const avatarUrl = session?.user?.avatarUrl || '';

  useEffect(() => {
    function handleClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
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

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
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

      {open && (
        <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
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
        </div>
      )}
    </div>
  );
}
