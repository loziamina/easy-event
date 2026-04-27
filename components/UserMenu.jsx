import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { signOut, useSession } from 'next-auth/react';

function initials(name, email) {
  const base = (name || email || 'U').trim();
  const parts = base.split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
}

export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 72, right: 16 });
  const wrapperRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const avatarUrl = session?.user?.avatarUrl || '';

  useEffect(() => {
    setMounted(true);

    function handleClick(event) {
      const clickedButton = wrapperRef.current?.contains(event.target);
      const clickedMenu = menuRef.current?.contains(event.target);
      if (!clickedButton && !clickedMenu) {
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

  function toggleMenu() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 12,
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    setOpen((current) => !current);
  }

  return (
    <div ref={wrapperRef}>
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
    </div>
  );
}
