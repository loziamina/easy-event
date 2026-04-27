import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import { useToast } from './ToastProvider';

const fetcher = (url) => fetch(url).then((res) => res.json());
const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REFUSED'];

function statusBadge(status) {
  if (status === 'RESOLVED') return 'bg-green-50 text-green-700 border-green-200';
  if (status === 'REFUSED') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'IN_PROGRESS') return 'bg-blue-50 text-blue-700 border-blue-200';
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

export default function Tickets({ navTarget }) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isPlatformAdmin = role === 'PLATFORM_ADMIN';
  const isOrganizerUser = ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(role);
  const { success, error, info } = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [form, setForm] = useState({ title: '', description: '' });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    return `/api/tickets${params.toString() ? `?${params.toString()}` : ''}`;
  }, [statusFilter]);

  const { data, mutate, isLoading } = useSWR(isPlatformAdmin || isOrganizerUser ? query : null, fetcher);
  const tickets = data?.tickets || [];
  const summary = data?.summary || { total: 0, open: 0, inProgress: 0, resolved: 0, refused: 0 };

  useEffect(() => {
    if (navTarget?.type !== 'ticket' || !navTarget?.id || tickets.length === 0) return;
    const element = document.getElementById(`ticket-${navTarget.id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [navTarget, tickets.length]);

  async function createTicket(e) {
    e.preventDefault();
    const title = form.title.trim();
    const description = form.description.trim();
    if (!title || !description) {
      error('Ticket incomplet', 'Ajoute un objet et une description.');
      return;
    }

    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      error('Creation impossible', payload.message || 'Le ticket n a pas pu etre cree.');
      return;
    }

    setForm({ title: '', description: '' });
    success('Ticket cree', 'La demande a ete envoyee a la plateforme.');
    mutate();
  }

  async function updateStatus(id, status) {
    const res = await fetch('/api/tickets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      error('Mise a jour impossible', payload.message || 'Le ticket n a pas pu etre modifie.');
      return;
    }
    info('Ticket mis a jour', `Statut passe a ${status}.`);
    mutate();
  }

  function openSupportConversation(ticket) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('selectedChatMode', 'support');
    if (ticket?.requester?.id) {
      window.localStorage.setItem('selectedChatClientId', String(ticket.requester.id));
    } else {
      window.removeItem('selectedChatClientId');
    }
    window.dispatchEvent(new CustomEvent('easy-event:navigate', { detail: { view: 'chat' } }));
    info('Canal support', 'Conversation ouverte pour ce ticket.');
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{isPlatformAdmin ? 'Issues organisateurs' : 'Mes tickets support'}</h2>
          <p className="text-gray-500 mt-1">
            {isPlatformAdmin
              ? 'Traite les demandes des organisateurs, mets a jour leur statut et ouvre la discussion si besoin.'
              : 'Cree et suis tes demandes aupres de la plateforme EasyEvent.'}
          </p>
        </div>

        <div className="w-full md:w-[240px]">
          <label className="text-sm font-semibold text-gray-700">Filtre statut</label>
          <select className="w-full mt-1 p-3 border rounded-lg" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tous</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Ouverts" value={summary.open} helper="A prendre en charge" />
        <SummaryCard label="En cours" value={summary.inProgress} />
        <SummaryCard label="Resolus / refuses" value={`${summary.resolved} / ${summary.refused}`} />
      </div>

      {isOrganizerUser ? (
        <form onSubmit={createTicket} className="bg-white border rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Creer un ticket</h3>
            <p className="text-sm text-gray-500 mt-1">Explique ton besoin, un bug, une demande d aide ou une demande d activation.</p>
          </div>
          <input
            className="w-full p-3 border rounded-lg"
            placeholder="Objet du ticket"
            value={form.title}
            onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
          />
          <textarea
            className="w-full min-h-[140px] p-3 border rounded-lg"
            placeholder="Decris ta demande..."
            value={form.description}
            onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
          />
          <div className="flex items-center gap-3">
            <button className="px-5 py-3 rounded-lg bg-violet-600 text-white font-semibold hover:bg-violet-700">
              Envoyer le ticket
            </button>
          </div>
        </form>
      ) : null}

      <div className="space-y-4">
        {tickets.map((ticket) => (
          <article
            key={ticket.id}
            id={`ticket-${ticket.id}`}
            className={`bg-white border rounded-xl p-5 shadow-sm ${String(navTarget?.type) === 'ticket' && String(navTarget?.id) === String(ticket.id) ? 'ring-2 ring-indigo-300 ring-offset-2' : ''}`}
          >
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold">{ticket.title}</h3>
                  <span className={`px-2 py-1 rounded-full border text-xs font-semibold ${statusBadge(ticket.status)}`}>
                    {ticket.status}
                  </span>
                </div>

                <dl className="grid md:grid-cols-2 gap-3 text-sm">
                  {isPlatformAdmin ? (
                    <>
                      <div>
                        <dt className="text-gray-500">Organisateur</dt>
                        <dd className="font-medium">{ticket.organizer?.name || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Demandeur</dt>
                        <dd className="font-medium">{ticket.requester?.name || ticket.requester?.email || '-'}</dd>
                      </div>
                    </>
                  ) : (
                    <div>
                      <dt className="text-gray-500">Espace organisateur</dt>
                      <dd className="font-medium">{ticket.organizer?.name || '-'}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-gray-500">Cree le</dt>
                    <dd className="font-medium">{new Date(ticket.createdAt).toLocaleDateString('fr-FR')}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Derniere mise a jour</dt>
                    <dd className="font-medium">{new Date(ticket.updatedAt).toLocaleDateString('fr-FR')}</dd>
                  </div>
                </dl>

                <div className="text-sm">
                  <p className="font-semibold text-gray-700 mb-1">Description</p>
                  <p className="text-gray-600 whitespace-pre-wrap">{ticket.description}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 min-w-[200px]">
                {(isPlatformAdmin ? ticket.status === 'IN_PROGRESS' : ticket.status === 'IN_PROGRESS') ? (
                  <button
                    onClick={() => openSupportConversation(ticket)}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
                  >
                    Communiquer
                  </button>
                ) : null}
                {isPlatformAdmin ? (
                  <>
                    <button
                      onClick={() => updateStatus(ticket.id, 'IN_PROGRESS')}
                      className="px-4 py-2 rounded-lg bg-blue-100 text-blue-800 font-semibold hover:bg-blue-200"
                    >
                      En cours
                    </button>
                    <button
                      onClick={() => updateStatus(ticket.id, 'RESOLVED')}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700"
                    >
                      Resoudre
                    </button>
                    <button
                      onClick={() => updateStatus(ticket.id, 'REFUSED')}
                      className="px-4 py-2 rounded-lg bg-rose-100 text-rose-800 font-semibold hover:bg-rose-200"
                    >
                      Refuser
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

      {!isLoading && tickets.length === 0 ? (
        <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
          Aucun ticket pour ce filtre.
        </div>
      ) : null}
    </section>
  );
}
