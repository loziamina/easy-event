import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
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

function isVideo(url, fileType) {
  return fileType === 'video' || /\.(mp4|webm|mov)$/i.test(String(url || ''));
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

function MockupCard({ mockup, isStaff, onAction, onDelete, onEdit }) {
  const [comment, setComment] = useState('');
  const [viewer, setViewer] = useState(null);
  const mediaItems = [
    mockup.url ? { url: mockup.url, type: mockup.fileType || 'image', label: mockup.title } : null,
    ...(mockup.moodboard || []).map((url, index) => ({
      url,
      type: isVideo(url, '') ? 'video' : isVisual(url, '') ? 'image' : 'link',
      label: `Moodboard ${index + 1}`,
    })),
  ].filter(Boolean);
  const activeMedia = viewer != null ? mediaItems[viewer] : null;

  async function submitComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    await onAction(mockup.id, 'comment', comment);
    setComment('');
  }

  function openViewer(index) {
    const item = mediaItems[index];
    if (!item) return;
    if (item.type !== 'image' && item.type !== 'video') {
      window.open(item.url, '_blank', 'noopener,noreferrer');
      return;
    }
    setViewer(index);
  }

  function moveViewer(direction) {
    setViewer((current) => {
      if (current == null || mediaItems.length === 0) return current;
      return (current + direction + mediaItems.length) % mediaItems.length;
    });
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
            <button type="button" onClick={() => openViewer(0)} className="block w-full focus:outline-none focus:ring-4 focus:ring-indigo-100">
              <img src={mockup.url} alt={mockup.title} className="max-h-[460px] w-full rounded-[1.2rem] border border-slate-200 object-contain bg-slate-50" />
            </button>
          ) : isVideo(mockup.url, mockup.fileType) ? (
            <button type="button" onClick={() => openViewer(0)} className="block w-full focus:outline-none focus:ring-4 focus:ring-indigo-100">
              <video src={mockup.url} controls className="max-h-[460px] w-full rounded-[1.2rem] border border-slate-200 bg-slate-950" />
            </button>
          ) : (
            <a href={mockup.url} target="_blank" rel="noreferrer" className="block rounded-[1.2rem] border border-indigo-100 bg-indigo-50 p-6 font-semibold text-indigo-700">
              Ouvrir la maquette PDF / Canva / fichier
            </a>
          )}
        </div>

        {mockup.moodboard?.length > 0 ? (
          <div>
            <h4 className="text-lg font-bold text-slate-900">Moodboard inspiration deco</h4>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {mockup.moodboard.map((src, index) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => openViewer(index + 1)}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-left focus:outline-none focus:ring-4 focus:ring-indigo-100"
                >
                  {isVideo(src, '') ? (
                    <video src={src} className="h-28 w-full object-cover bg-slate-950" />
                  ) : isVisual(src, '') ? (
                    <img src={src} alt="" className="h-28 w-full object-cover" />
                  ) : (
                    <span className="flex h-28 items-center justify-center p-3 text-center text-sm font-semibold text-indigo-700">
                      Ouvrir le fichier
                    </span>
                  )}
                </button>
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
                <>
                  <button onClick={() => onEdit(mockup)} className="app-button-secondary rounded-xl px-4 py-3 font-semibold">
                    Modifier
                  </button>
                  <button onClick={() => onDelete(mockup.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 font-semibold text-rose-700 hover:bg-rose-100">
                    Supprimer
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {activeMedia ? (
        <div className="fixed inset-0 z-[9999] bg-slate-950/90 p-4 md:p-8">
          <div className="mx-auto flex h-full max-w-6xl flex-col">
            <div className="mb-4 flex items-center justify-between gap-3 text-white">
              <div>
                <p className="text-sm uppercase tracking-[0.08em] text-white/60">{activeMedia.label}</p>
                <p className="text-lg font-semibold">{viewer + 1} / {mediaItems.length}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewer(null)}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
              >
                Fermer
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-[auto_1fr_auto] items-center gap-3">
              <button
                type="button"
                onClick={() => moveViewer(-1)}
                className="h-12 w-12 rounded-full border border-white/20 bg-white/10 text-2xl font-bold text-white hover:bg-white/20 disabled:opacity-30"
                disabled={mediaItems.length < 2}
                aria-label="Media precedent"
              >
                &lt;
              </button>

              <div className="flex min-h-0 items-center justify-center">
                {activeMedia.type === 'video' ? (
                  <video src={activeMedia.url} controls autoPlay className="max-h-[78vh] max-w-full rounded-2xl bg-black" />
                ) : (
                  <img src={activeMedia.url} alt={activeMedia.label} className="max-h-[78vh] max-w-full rounded-2xl object-contain" />
                )}
              </div>

              <button
                type="button"
                onClick={() => moveViewer(1)}
                className="h-12 w-12 rounded-full border border-white/20 bg-white/10 text-2xl font-bold text-white hover:bg-white/20 disabled:opacity-30"
                disabled={mediaItems.length < 2}
                aria-label="Media suivant"
              >
                &gt;
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function Mockups({ navTarget }) {
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
  const [editingId, setEditingId] = useState(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const { success, error, info } = useToast();

  useEffect(() => {
    if (navTarget?.type !== 'mockup' || !navTarget?.id || mockups.length === 0) return;
    const element = document.getElementById(`mockup-${navTarget.id}`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [navTarget, mockups.length]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadOneMediaFile(file) {
    const isVideoFile = file.type.startsWith('video/');
    const isImageFile = file.type.startsWith('image/');

    if (!isVideoFile && !isImageFile) {
      error('Upload impossible', 'Ajoute une image ou une video.');
      return;
    }

    const maxBytes = isVideoFile ? 25 * 1024 * 1024 : 6 * 1024 * 1024;
    if (file.size > maxBytes) {
      error(
        'Upload impossible',
        isVideoFile ? 'La video ne doit pas depasser 25 Mo.' : 'La photo ne doit pas depasser 6 Mo.'
      );
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    const res = await fetch('/api/uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl,
        filename: file.name,
        category: isVideoFile ? 'portfolio-video' : 'portfolio-image',
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload.message || payload.error || 'Upload impossible');
    }

    return {
      url: payload.url,
      fileType: isVideoFile ? 'video' : 'image',
    };
  }

  async function uploadMediaFiles(files) {
    const selectedFiles = Array.from(files || []);
    if (selectedFiles.length === 0) return;

    setUploadingMedia(true);
    try {
      const uploaded = [];
      for (const file of selectedFiles) {
        uploaded.push(await uploadOneMediaFile(file));
      }

      setForm((current) => ({
        ...current,
        url: current.url || uploaded[0]?.url || '',
        fileType: current.url ? current.fileType : uploaded[0]?.fileType || current.fileType,
        moodboardText: [
          ...parseMoodboardText(current.moodboardText),
          ...uploaded.map((item) => item.url).filter(Boolean),
        ].join(', '),
      }));
      success('Fichiers uploades', `${uploaded.length} fichier(s) ajoute(s) a la maquette.`);
    } catch (uploadError) {
      error('Upload impossible', uploadError.message);
    } finally {
      setUploadingMedia(false);
    }
  }

  function parseMoodboardText(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function startEditing(mockup) {
    setEditingId(mockup.id);
    setForm({
      eventId: String(mockup.eventId || ''),
      title: mockup.title || '',
      url: mockup.url || '',
      fileType: mockup.fileType || 'image',
      description: mockup.description || '',
      moodboardText: (mockup.moodboard || []).join(', '),
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function uploadMockup(e) {
    e.preventDefault();
    const res = await fetch('/api/mockups', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId,
        action: editingId ? 'update' : undefined,
        ...form,
        moodboard: form.moodboardText,
      }),
    });
    if (res.ok) {
      setEditingId(null);
      setForm(emptyForm);
      mutate();
      success(editingId ? 'Maquette modifiee' : 'Maquette ajoutee');
    } else {
      error(editingId ? 'Modification impossible' : 'Ajout impossible', await res.text());
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
            <h3 className="text-xl font-bold text-slate-900">{editingId ? 'Modifier la maquette' : 'Ajouter une maquette'}</h3>
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
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Photo, video, PDF ou lien Canva</span>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input className="app-input min-w-0 flex-1 rounded-xl px-4 py-3" placeholder="URL photo / video / PDF / Canva" value={form.url} onChange={(e) => updateField('url', e.target.value)} required />
                <label className="app-button-secondary flex cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold">
                  {uploadingMedia ? 'Upload...' : 'Uploader'}
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                    className="sr-only"
                    disabled={uploadingMedia}
                    onChange={(e) => {
                      uploadMediaFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </label>
            <select className="app-select rounded-xl px-4 py-3" value={form.fileType} onChange={(e) => updateField('fileType', e.target.value)}>
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="pdf">PDF</option>
              <option value="canva">Canva</option>
            </select>
            <input className="app-input rounded-xl px-4 py-3 md:col-span-2" placeholder="Moodboard URLs separees par virgules" value={form.moodboardText} onChange={(e) => updateField('moodboardText', e.target.value)} />
            <textarea className="app-textarea min-h-[110px] rounded-xl px-4 py-3 md:col-span-2" placeholder="Description / modifications apportees" value={form.description} onChange={(e) => updateField('description', e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="app-button-primary rounded-xl px-5 py-3 font-semibold">
              {editingId ? 'Enregistrer la maquette' : 'Ajouter version'}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEditing} className="app-button-secondary rounded-xl px-5 py-3 font-semibold">
                Annuler
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="space-y-4">
        {mockups.map((mockup) => (
          <div
            key={mockup.id}
            id={`mockup-${mockup.id}`}
            className={String(navTarget?.type) === 'mockup' && String(navTarget?.id) === String(mockup.id) ? 'rounded-2xl ring-2 ring-indigo-300 ring-offset-2' : ''}
          >
            <MockupCard
              mockup={mockup}
              isStaff={isStaff}
              onAction={mockupAction}
              onDelete={deleteMockup}
              onEdit={startEditing}
            />
          </div>
        ))}
        {mockups.length === 0 ? (
          <div className="page-section p-6 text-slate-500">Aucune maquette.</div>
        ) : null}
      </div>
    </section>
  );
}
