import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { useToast } from './ToastProvider';

const fetcher = (url) => fetch(url).then((res) => res.json());
const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'SUSPENDED'];

function statusBadge(status) {
  if (status === 'APPROVED') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'SUSPENDED') return 'bg-red-50 text-red-700 border-red-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

function SummaryCard({ label, value, helper }) {
  return (
    <div className="bg-white border rounded-xl p-5 shadow-sm">
      <p className="text-sm font-semibold text-gray-500">{label}</p>
      <p className="text-3xl font-bold mt-2">{value}</p>
      {helper ? <p className="text-sm text-gray-500 mt-2">{helper}</p> : null}
    </div>
  );
}

export default function OrganizerManagement() {
  const [statusFilter, setStatusFilter] = useState('');
  const { success, error, info } = useToast();

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    return `/api/admin/organizers${params.toString() ? `?${params.toString()}` : ''}`;
  }, [statusFilter]);

  const { data, mutate, isLoading } = useSWR(query, fetcher);
  const organizers = data?.organizers || [];
  const summary = data?.summary || { total: 0, pending: 0, approved: 0, suspended: 0 };

  async function updateStatus(id, status) {
    const res = await fetch('/api/admin/organizers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      error('Mise a jour impossible', payload.message || 'Erreur mise a jour statut');
      return;
    }

    success('Statut mis a jour', `Organisateur passe a ${status}.`);
    mutate();
  }

  function openConversation(organizer) {
    if (!organizer?.owner?.id || typeof window === 'undefined') return;
    window.localStorage.setItem('selectedChatMode', 'support');
    window.localStorage.setItem('selectedChatClientId', String(organizer.owner.id));
    window.dispatchEvent(new CustomEvent('easy-event:navigate', { detail: { view: 'chat' } }));
    info('Conversation ouverte', `Canal support pret pour ${organizer.name}.`);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Organisateurs</h2>
          <p className="text-gray-500 mt-1">
            Valide, suspend ou revois les demandes organisateur avant publication sur la marketplace.
          </p>
        </div>

        <div className="w-full md:w-[240px]">
          <label className="text-sm font-semibold text-gray-700">Filtre statut</label>
          <select
            className="w-full mt-1 p-3 border rounded-lg"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tous</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="En attente" value={summary.pending} helper="Demandes a traiter" />
        <SummaryCard label="Approuves" value={summary.approved} />
        <SummaryCard label="Suspendus" value={summary.suspended} />
      </div>

      <div className="space-y-4">
        {organizers.map((organizer) => (
          <article key={organizer.id} className="bg-white border rounded-xl p-5 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold">{organizer.name}</h3>
                  <span className={`px-2 py-1 rounded-full border text-xs font-semibold ${statusBadge(organizer.status)}`}>
                    {organizer.status}
                  </span>
                </div>

                <dl className="grid md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-gray-500">Owner</dt>
                    <dd className="font-medium">{organizer.owner?.name || organizer.owner?.email || 'Non renseigne'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Email</dt>
                    <dd className="font-medium">{organizer.owner?.email || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Telephone</dt>
                    <dd className="font-medium">{organizer.owner?.phone || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Ville</dt>
                    <dd className="font-medium">{organizer.city || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Adresse</dt>
                    <dd className="font-medium">{organizer.address || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Zone d'intervention</dt>
                    <dd className="font-medium">{organizer.serviceArea || '-'}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Equipe</dt>
                    <dd className="font-medium">{organizer.counts.users}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Offres / evenements</dt>
                    <dd className="font-medium">{organizer.counts.products} / {organizer.counts.events}</dd>
                  </div>
                </dl>

                {organizer.description ? (
                  <div className="text-sm">
                    <p className="font-semibold text-gray-700 mb-1">Description</p>
                    <p className="text-gray-600">{organizer.description}</p>
                  </div>
                ) : null}

                <p className="text-xs text-gray-500">
                  Demande creee le {new Date(organizer.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>

              <div className="flex flex-col gap-2 min-w-[180px]">
                <button
                  onClick={() => openConversation(organizer)}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
                >
                  Communiquer
                </button>
                <button
                  onClick={() => updateStatus(organizer.id, 'APPROVED')}
                  className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
                >
                  Approuver
                </button>
                <button
                  onClick={() => updateStatus(organizer.id, 'PENDING')}
                  className="px-4 py-2 rounded-lg bg-amber-100 text-amber-800 font-semibold hover:bg-amber-200"
                >
                  Repasser en attente
                </button>
                <button
                  onClick={() => updateStatus(organizer.id, 'SUSPENDED')}
                  className="px-4 py-2 rounded-lg bg-red-100 text-red-800 font-semibold hover:bg-red-200"
                >
                  Suspendre
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {!isLoading && organizers.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          Aucune demande organisateur pour ce filtre.
        </div>
      ) : null}
    </section>
  );
}
