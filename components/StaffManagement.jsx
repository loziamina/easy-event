import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from './ToastProvider';

export default function StaffManagement() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isPlatformAdmin = role === 'PLATFORM_ADMIN';
  const isOrganizerUser = ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(role);
  const { success, error, info } = useToast();
  const availableRoles = useMemo(
    () => (isPlatformAdmin ? ['ORGANIZER_STAFF', 'ORGANIZER_OWNER', 'PLATFORM_ADMIN'] : ['ORGANIZER_STAFF']),
    [isPlatformAdmin]
  );

  const initialForm = useMemo(
    () => ({
      email: '',
      password: '',
      name: '',
      role: availableRoles[0],
      phone: '',
      address: '',
    }),
    [availableRoles]
  );

  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  async function loadStaff() {
    const res = await fetch('/api/admin/staff');
    const data = await res.json().catch(() => ({}));
    if (res.ok) setUsers(data.users || []);
  }

  useEffect(() => {
    loadStaff();
  }, []);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createStaff(e) {
    e.preventDefault();
    setMessage('');

    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setForm(initialForm);
      setMessage('Compte cree');
      success('Compte cree', 'Le membre a ete ajoute a l equipe.');
      loadStaff();
    } else {
      setMessage(data.message || 'Erreur creation compte');
      error('Creation impossible', data.message || 'Erreur creation compte');
    }
  }

  async function updateRole(id, nextRole) {
    const res = await fetch('/api/admin/staff', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: nextRole }),
    });
    if (res.ok) {
      info('Role mis a jour', 'Le role du membre a ete modifie.');
      loadStaff();
    }
  }

  async function deleteStaff(id) {
    const res = await fetch('/api/admin/staff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      info('Membre supprime', 'Le compte equipe a ete retire.');
      loadStaff();
    }
  }

  function openTeamConversation(user) {
    if (!user?.id || typeof window === 'undefined') return;
    window.localStorage.setItem('selectedChatMode', 'team');
    window.localStorage.setItem('selectedChatClientId', String(user.id));
    window.dispatchEvent(new CustomEvent('easy-event:navigate', { detail: { view: 'chat' } }));
    info('Conversation equipe', `Canal ouvert avec ${user.name || user.email}.`);
  }

  function openPlatformSupport() {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('selectedChatMode', 'support');
    window.removeItem('selectedChatClientId');
    window.dispatchEvent(new CustomEvent('easy-event:navigate', { detail: { view: 'chat' } }));
    info('Support plateforme', 'Canal support pret pour ta demande.');
  }

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">
        {isPlatformAdmin ? 'Equipe plateforme et organisateurs' : "Equipe de l'organisateur"}
      </h2>

      {isOrganizerUser ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">Besoin de la plateforme ?</p>
            <p className="text-sm text-slate-600">Ouvre un ticket ou discute directement avec l admin EasyEvent.</p>
          </div>
          <button onClick={openPlatformSupport} className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800">
            Contacter l admin
          </button>
        </div>
      ) : null}

      <form onSubmit={createStaff} className="bg-white border rounded-lg p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <input className="p-3 border rounded-lg" placeholder="Nom" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
        <input className="p-3 border rounded-lg" placeholder="Email" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
        <input className="p-3 border rounded-lg" placeholder="Mot de passe" type="password" value={form.password} onChange={(e) => updateField('password', e.target.value)} />
        <select className="p-3 border rounded-lg" value={form.role} onChange={(e) => updateField('role', e.target.value)}>
          {availableRoles.map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <input className="p-3 border rounded-lg" placeholder="Telephone" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
        <input className="p-3 border rounded-lg" placeholder="Adresse" value={form.address} onChange={(e) => updateField('address', e.target.value)} />

        <div className="md:col-span-2 flex items-center gap-3">
          <button className="bg-violet-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-violet-700">
            Ajouter
          </button>
          {message && <span className="text-sm text-gray-600">{message}</span>}
        </div>
      </form>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="p-3">Nom</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="p-3">{user.name || '-'}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">
                  <select className="p-2 border rounded-lg" value={user.role} onChange={(e) => updateRole(user.id, e.target.value)}>
                    {(isPlatformAdmin ? ['ORGANIZER_STAFF', 'ORGANIZER_OWNER', 'PLATFORM_ADMIN'] : ['ORGANIZER_STAFF']).map((value) => (
                      <option key={value} value={value}>{value}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-3">
                    {isOrganizerUser ? (
                      <button className="text-slate-700 font-semibold" onClick={() => openTeamConversation(user)}>
                        Communiquer
                      </button>
                    ) : null}
                    <button className="text-red-600 font-semibold" onClick={() => deleteStaff(user.id)}>
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td className="p-4 text-gray-500" colSpan={4}>Aucun membre.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
