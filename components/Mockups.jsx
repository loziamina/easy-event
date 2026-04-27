import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { useToast } from './ToastProvider';

const fetcher = (url) => fetch(url).then((res) => res.json());

const emptyForm = {
  eventId: '',
  title: '',
  url: '',
  fileType: 'image',
  description: '',
  moodboardText: '',
};

function statusLabel(status) {
  return {
    PENDING: 'En attente',
    APPROVED: 'Validee',
    CHANGES_REQUESTED: 'Modifications demandees',
  }[status] || status;
}

function statusTone(status) {
  const map = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CHANGES_REQUESTED: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function isVisual(url, fileType) {
  return fileType === 'image' || /\.(png|jpe?g|webp|gif)$/i.test(String(url || ''));
}

function StatCard({ label, value, helper, accent = 'primary' }) {
  const accents = {
    primary: 'from-indigo-50 via-violet-50 to-white border-indigo-100',
    green: 'from-emerald-50 via-teal-50 to-white border-emerald-100',
    warm: 'from-amber-50 via-orange-50 to-white border-amber-100',
    pink: 'from-pink-50 via-rose-50 to-white border-pink-100',
  };

  return (
    <article className={`rounded-[1.35rem] border bg-gradient-to-br p-5 shadow-sm ${accents[accent] || accents.primary}`}>
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {helper ? <p className="mt-3 text-sm text-slate-500">{helper}</p> : null}
    </article>
  );
}

function CommentBlock({ item }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
      <p className="font-semibold text-slate-900">{item.authorRole || 'USER'}</p>
      <p className="mt-1 whitespace-pre-wrap text-slate-600">{item.text}</p>
      <p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('fr-FR')}</p>
    </div>
  );
}

function MockupCard({ mockup, isStaff, onAction, onDelete }) {
  const [comment, setComment] = useState('');

  async function submitComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    await onAction(mockup.id, 'comment', comment);
    setComment('');
  }

  return (
    <article className="surface-card overflow-hidden rounded-[1.6rem]">
      <div className="border-b border-slate-200 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xl font-bold text-slate-900 md:text-2xl">{mockup.title}</h3>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                v{mockup.version}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {mockup.event?.name} - {mockup.event?.owner?.name || mockup.event?.owner?.email}
            </p>
            {mockup.description ? <p className="mt-2 text-sm text-slate-600">{mockup.description}</p> : null}
          </div>
          <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusTone(mockup.status)}`}>
            {statusLabel(mockup.status)}
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <div className="rounded-[1.4rem] border border-slate-200 bg-white p-4">
          {isVisual(mockup.url, mockup.fileType) ? (
            <img src={mockup.url} alt={mockup.title} className="max-h-[460px] w-full rounded-[1.2rem] border border-slate-200 object-contain bg-slate-50" />
          ) : (
            <a href={mockup.url} target="_blank" rel="noreferrer" className="block rounded-[1.2rem] border border-indigo-100 bg-indigo-50 p-6 font-semibold text-indigo-700">
              Ouvrir la maquette PDF / Canva
            </a>
          )}
        </div>

        {mockup.moodboard?.length > 0 ? (
          <div>
            <h4 className="text-lg font-bold text-slate-900">Moodboard inspiration deco</h4>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {mockup.moodboard.map((src) => (
                <img key={src} src={src} alt="" className="h-28 w-full rounded-xl border border-slate-200 bg-slate-50 object-cover" />
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <h4 className="text-lg font-bold text-slate-900">Commentaires</h4>
            <div className="mt-4 space-y-3">
              {mockup.comments.map((item) => (
                <CommentBlock key={item.id} item={item} />
              ))}
              {mockup.comments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Aucun commentaire.
                </div>
              ) : null}
            </div>

            <form onSubmit={submitComment} className="mt-4 flex flex-col gap-2 md:flex-row">
              <input className="app-input flex-1 rounded-xl px-4 py-3" placeholder="Ajouter un commentaire" value={comment} onChange={(e) => setComment(e.target.value)} />
              <button className="app-button-primary rounded-xl px-4 py-3 font-semibold">Commenter</button>
            </form>
          </div>

          <div className="rounded-[1.3rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-lg font-bold text-slate-900">Validation</h4>
            <p className="mt-2 text-sm text-slate-500">
              {isStaff
                ? 'Suis la validation client, les retours et les demandes de modification sur cette version.'
                : 'Valide la maquette si tout est bon, ou demande des ajustements si besoin.'}
            </p>

            <div className="mt-5 flex flex-col gap-3">
              {!isStaff && mockup.status === 'PENDING' ? (
                <>
                  <button onClick={() => onAction(mockup.id, 'approve')} className="rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700">
                    Valider la maquette
                  </button>
                  <button onClick={() => onAction(mockup.id, 'changes')} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-800 hover:bg-amber-100">
                    Demander modifications
                  </button>
                </>
              ) : null}
              {isStaff ? (
                <button onClick={() => onDelete(mockup.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 font-semibold text-rose-700 hover:bg-rose-100">
                  Supprimer
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Mockups() {
  const { data: session } = useSession();
  const isStaff = ['PLATFORM_ADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(session?.user?.role);
  const { data, mutate } = useSWR('/api/mockups', fetcher);
  const { data: eventsData } = useSWR(isStaff ? '/api/events' : null, fetcher);
  const mockups = data?.mockups || [];
  const events = useMemo(() => {
    return (eventsData?.events || []).filter((event) => ['ACCEPTED', 'PLANNED', 'DONE'].includes(event.status));
  }, [eventsData]);

  const pendingCount = mockups.filter((item) => item.status === 'PENDING').length;
  const approvedCount = mockups.filter((item) => item.status === 'APPROVED').length;
  const changesCount = mockups.filter((item) => item.status === 'CHANGES_REQUESTED').length;

  const [form, setForm] = useState(emptyForm);
  const { success, error, info } = useToast();

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function uploadMockup(e) {
    e.preventDefault();
    const res = await fetch('/api/mockups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        moodboard: form.moodboardText,
      }),
    });
    if (res.ok) {
      setForm(emptyForm);
      mutate();
      success('Maquette ajoutee');
    } else {
      error('Ajout impossible', await res.text());
    }
  }

  async function mockupAction(id, action, text) {
    const res = await fetch('/api/mockups', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, text }),
    });
    if (res.ok) {
      mutate();
      success('Maquette mise a jour');
    } else {
      error('Action impossible', await res.text());
    }
  }

  async function deleteMockup(id) {
    const res = await fetch('/api/mockups', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      mutate();
      info('Maquette supprimee');
    } else {
      error('Suppression impossible', await res.text());
    }
  }

  return (
    <section className="space-y-6">
      <div className="page-section p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="app-stat-badge">Validation visuelle</span>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">Maquettes & visuels</h2>
            <p className="mt-2 text-slate-600">
              Gere les versions, centralise les retours et fais avancer la validation client avec plus de clarte.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <StatCard label="En attente" value={pendingCount} accent="warm" />
            <StatCard label="Validees" value={approvedCount} accent="green" />
            <StatCard label="A revoir" value={changesCount} accent="pink" />
          </div>
        </div>
      </div>

      {isStaff ? (
        <form onSubmit={uploadMockup} className="surface-card rounded-[1.6rem] p-6 space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Ajouter une maquette</h3>
            <p className="mt-1 text-sm text-slate-500">Publie une nouvelle version, un PDF ou un lien Canva avec ses inspirations.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <select className="app-select rounded-xl px-4 py-3" value={form.eventId} onChange={(e) => updateField('eventId', e.target.value)} required>
              <option value="">Evenement</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.name} - {event.owner?.name || event.owner?.email}</option>
              ))}
            </select>
            <input className="app-input rounded-xl px-4 py-3" placeholder="Titre maquette" value={form.title} onChange={(e) => updateField('title', e.target.value)} required />
            <input className="app-input rounded-xl px-4 py-3" placeholder="URL image / PDF / Canva" value={form.url} onChange={(e) => updateField('url', e.target.value)} required />
            <select className="app-select rounded-xl px-4 py-3" value={form.fileType} onChange={(e) => updateField('fileType', e.target.value)}>
              <option value="image">Image</option>
              <option value="pdf">PDF</option>
              <option value="canva">Canva</option>
            </select>
            <input className="app-input rounded-xl px-4 py-3 md:col-span-2" placeholder="Moodboard URLs separees par virgules" value={form.moodboardText} onChange={(e) => updateField('moodboardText', e.target.value)} />
            <textarea className="app-textarea min-h-[110px] rounded-xl px-4 py-3 md:col-span-2" placeholder="Description / modifications apportees" value={form.description} onChange={(e) => updateField('description', e.target.value)} />
          </div>
          <button className="app-button-primary rounded-xl px-5 py-3 font-semibold">Ajouter version</button>
        </form>
      ) : null}

      <div className="space-y-4">
        {mockups.map((mockup) => (
          <MockupCard
            key={mockup.id}
            mockup={mockup}
            isStaff={isStaff}
            onAction={mockupAction}
            onDelete={deleteMockup}
          />
        ))}
        {mockups.length === 0 ? (
          <div className="page-section p-6 text-slate-500">Aucune maquette.</div>
        ) : null}
      </div>
    </section>
  );
}
