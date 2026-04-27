import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import OrganizerDirectory from './OrganizerDirectory';

const fetcher = (url) => fetch(url).then((r) => r.json());

function StatCard({ label, value, helper, accent = 'primary' }) {
  const accentClasses = {
    primary: 'from-indigo-50 via-violet-50 to-white text-indigo-700 border-indigo-100',
    warm: 'from-amber-50 via-orange-50 to-white text-amber-700 border-amber-100',
    green: 'from-emerald-50 via-teal-50 to-white text-emerald-700 border-emerald-100',
    pink: 'from-pink-50 via-rose-50 to-white text-pink-700 border-pink-100',
  };

  return (
    <article className={`rounded-[1.4rem] border bg-gradient-to-br p-6 shadow-sm ${accentClasses[accent] || accentClasses.primary}`}>
      <p className="text-sm font-semibold uppercase tracking-[0.04em] text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-bold text-slate-900">{value}</p>
      {helper ? <p className="mt-3 text-sm text-slate-500">{helper}</p> : null}
    </article>
  );
}

function WelcomeHero({ session, isClient, isPlatformAdmin, organizerName, organizerStatus }) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/80 px-6 py-7 shadow-md backdrop-blur md:px-8 md:py-8">
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(167,139,250,0.22),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.16),transparent_36%)]" />

      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <span className="app-stat-badge">
            {isClient ? 'Espace client' : isPlatformAdmin ? 'Pilotage plateforme' : 'Espace organisateur'}
          </span>
          <h2 className="mt-4 text-3xl font-bold text-slate-900 md:text-4xl">
            Bonjour{session?.user?.name ? ` ${session.user.name}` : ''},
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            {isClient
              ? 'Explore les organisateurs autour de toi, compare leurs prestations, puis reserve en quelques clics dans le bon contexte.'
              : organizerName
                ? `${organizerName} est actuellement ${organizerStatus || 'PENDING'}. Tu peux suivre tes demandes, tes clients et ton activite depuis ici.`
                : 'Bienvenue sur ton tableau de bord EasyEvent. On te donne une vue claire, actionnable et simple a utiliser.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:w-auto sm:min-w-[270px]">
          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Navigation</p>
            <p className="mt-2 text-sm font-medium text-slate-700">Simple, centralisee et lisible</p>
          </div>
          <div className="rounded-2xl border border-white/80 bg-white/85 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Experience</p>
            <p className="mt-2 text-sm font-medium text-slate-700">Soft, moderne et rassurante</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PendingRequestCard({ organizer }) {
  return (
    <article className="rounded-[1.2rem] border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-base font-semibold text-slate-900">{organizer.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            {organizer.owner?.email || '-'}
            {organizer.city ? ` • ${organizer.city}` : ''}
          </p>
        </div>
        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
          En attente
        </span>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Demande creee le {new Date(organizer.createdAt).toLocaleDateString('fr-FR')}
      </p>
    </article>
  );
}

export default function Dashboard({ onSelectOrganizer }) {
  const { data: session } = useSession();
  const { data: eventsData } = useSWR('/api/events', fetcher);
  const { data: organizersAdminData } = useSWR(
    session?.user?.role === 'PLATFORM_ADMIN' ? '/api/admin/organizers' : null,
    fetcher
  );

  const events = eventsData?.events || [];
  const active = events.filter((event) => !['REFUSED', 'DONE'].includes(event.status)).length;
  const completed = events.filter((event) => event.status === 'DONE').length;
  const role = session?.user?.role;
  const isClient = role === 'CLIENT';
  const isPlatformAdmin = role === 'PLATFORM_ADMIN';
  const organizerName = session?.user?.organizerName || '';
  const organizerStatus = session?.user?.organizerStatus || '';
  const organizerSummary = organizersAdminData?.summary || { pending: 0, approved: 0, suspended: 0 };
  const recentPending = (organizersAdminData?.organizers || []).filter((item) => item.status === 'PENDING').slice(0, 3);
  const nextEvent = events.find((event) => ['PENDING_APPROVAL', 'ACCEPTED', 'PLANNED'].includes(event.status));

  return (
    <section className="space-y-8">
      <WelcomeHero
        session={session}
        isClient={isClient}
        isPlatformAdmin={isPlatformAdmin}
        organizerName={organizerName}
        organizerStatus={organizerStatus}
      />

      {isPlatformAdmin ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <StatCard label="Organisateurs en attente" value={organizerSummary.pending} helper="Demandes a valider" accent="warm" />
            <StatCard label="Organisateurs approuves" value={organizerSummary.approved} helper="Profils visibles cote client" accent="green" />
            <StatCard label="Organisateurs suspendus" value={organizerSummary.suspended} helper="Espaces temporairement bloques" accent="pink" />
          </div>

          <section className="page-section p-6 md:p-7">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Demandes recentes</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Les nouveaux organisateurs a valider en priorite.
                </p>
              </div>
              <span className="app-stat-badge">{recentPending.length} a traiter</span>
            </div>

            <div className="mt-5 space-y-4">
              {recentPending.map((organizer) => (
                <PendingRequestCard key={organizer.id} organizer={organizer} />
              ))}
              {recentPending.length === 0 ? (
                <div className="rounded-[1.2rem] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
                  Aucune demande en attente pour le moment.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <StatCard label="Evenements" value={events.length} helper="Tous statuts confondus" accent="primary" />
          <StatCard label="Actifs" value={active} helper="Demandes en cours de traitement" accent="green" />
          <StatCard
            label="Prochain"
            value={nextEvent?.name || '-'}
            helper={nextEvent?.date ? new Date(nextEvent.date).toLocaleDateString('fr-FR') : completed ? `${completed} evenement(s) termine(s)` : 'Aucun evenement programme'}
            accent="warm"
          />
        </div>
      )}

      {isClient ? <OrganizerDirectory onSelectOrganizer={onSelectOrganizer} /> : null}
    </section>
  );
}
