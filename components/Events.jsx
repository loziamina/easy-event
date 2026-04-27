import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import Modal from 'react-modal';
import Chat from './Chat';
import EventCart from './EventCart';
import { useToast } from './ToastProvider';

const customStyles = {
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    marginRight: '-50%',
    transform: 'translate(-50%, -50%)',
    width: '90%',
    maxWidth: '1000px',
    height: '85%',
    padding: 0,
    border: 'none',
    borderRadius: '1rem',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)',
  },
  overlay: { backgroundColor: 'rgba(15, 23, 42, 0.6)' },
};

if (typeof window !== 'undefined') {
  Modal.setAppElement('#__next');
}

const initialEventState = {
  organizerId: '',
  name: '',
  date: '',
  eventTime: '',
  occasionType: '',
  theme: '',
  location: '',
  guestCount: '',
  budget: '',
  notes: '',
  serviceBuffet: false,
  serviceDeco: false,
  serviceOrganisation: false,
  serviceGateaux: false,
  serviceMobilier: false,
  serviceAnimation: false,
  serviceLieu: false,
};

const serviceOptions = [
  ['serviceBuffet', 'Buffet'],
  ['serviceDeco', 'Decoration'],
  ['serviceOrganisation', 'Organisation complete'],
  ['serviceGateaux', 'Gateaux'],
  ['serviceMobilier', 'Mobilier'],
  ['serviceAnimation', 'Animation'],
  ['serviceLieu', 'Lieu'],
];

const staffTransitions = {
  PENDING_APPROVAL: [
    ['ACCEPTED', 'Accepter'],
    ['REFUSED', 'Refuser'],
    ['DRAFT', 'Repasser en brouillon'],
  ],
  ACCEPTED: [
    ['PLANNED', 'Planifier'],
    ['REFUSED', 'Refuser'],
  ],
  REFUSED: [['PENDING_APPROVAL', 'Remettre en attente']],
  PLANNED: [
    ['DONE', 'Terminer'],
    ['ACCEPTED', 'Revenir accepte'],
  ],
};

function statusTone(status) {
  const map = {
    DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
    PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REFUSED: 'bg-rose-50 text-rose-700 border-rose-200',
    PLANNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    DONE: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function formatDate(date) {
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeValue(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function dateLabel(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

function AvailabilityPicker({ organizerId, selectedDate, selectedTime, onSelectDate }) {
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(false);
  const selectedDay = availability.find((day) => day.date === selectedDate);

  useEffect(() => {
    if (!organizerId) {
      setAvailability([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ organizerId: String(organizerId), days: '30' });
    if (selectedDate) params.set('start', selectedDate);
    if (selectedTime) params.set('time', selectedTime);

    fetch(`/api/event-availability?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAvailability(data.days || []);
      })
      .catch(() => {
        if (!cancelled) setAvailability([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [organizerId, selectedDate, selectedTime]);

  if (!organizerId) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Choisis un organisateur pour voir les creneaux disponibles.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">Creneaux disponibles</p>
        {loading ? <span className="text-xs font-semibold text-slate-400">Chargement...</span> : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {availability.slice(0, 15).map((day) => (
          <button
            key={day.date}
            type="button"
            disabled={!day.available}
            onClick={() => onSelectDate(day.date)}
            className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
              selectedDate === day.date
                ? 'border-indigo-300 bg-indigo-50 text-indigo-800'
                : day.available
                  ? 'border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'
                  : 'cursor-not-allowed border-slate-200 bg-slate-200/70 text-slate-400 opacity-70'
            }`}
          >
            <span className="block">{dateLabel(day.date)}</span>
            <span className={`mt-1 block text-xs ${day.available ? 'text-emerald-600' : 'text-rose-500'}`}>
              {day.available ? (day.blockedRanges?.length ? 'Horaires bloques' : 'Disponible') : day.reason || 'Reserve'}
            </span>
          </button>
        ))}
      </div>

      {selectedDay?.blockedRanges?.length ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-semibold">Horaires deja bloques ce jour-la</p>
          <p className="mt-1">
            {selectedDay.blockedRanges.map((range) => `${range.start} - ${range.end}`).join(', ')}
          </p>
        </div>
      ) : null}

      {selectedDay && !selectedDay.available ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          Ce creneau est deja reserve. Choisis une autre date disponible.
        </p>
      ) : null}
    </div>
  );
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

function ServiceBadges({ event }) {
  const active = serviceOptions.filter(([key]) => event[key]);
  if (active.length === 0) {
    return <span className="text-sm text-slate-500">Aucun service selectionne</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map(([key, label]) => (
        <span key={key} className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          {label}
        </span>
      ))}
    </div>
  );
}

function EventAttachments({ event, onChanged }) {
  const { error, success } = useToast();
  const [form, setForm] = useState({ name: '', url: '', type: '' });
  const attachments = event.attachments || [];

  async function addAttachment(e) {
    e.preventDefault();
    const res = await fetch(`/api/events/${event.id}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      error('Piece jointe impossible', await res.text());
      return;
    }
    setForm({ name: '', url: '', type: '' });
    success('Piece jointe ajoutee');
    onChanged();
  }

  async function removeAttachment(id) {
    const res = await fetch(`/api/events/${event.id}/attachments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      success('Piece jointe retiree');
      onChanged();
    }
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <p className="text-sm font-semibold text-slate-900">Pieces jointes</p>
      <form onSubmit={addAttachment} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_140px_auto]">
        <input className="app-input rounded-xl px-3 py-2 text-sm" placeholder="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="app-input rounded-xl px-3 py-2 text-sm" placeholder="URL photo ou plan" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <input className="app-input rounded-xl px-3 py-2 text-sm" placeholder="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
        <button className="app-button-primary rounded-xl px-3 py-2 text-sm font-semibold">Ajouter</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <a href={attachment.url} target="_blank" rel="noreferrer" className="font-semibold text-indigo-700">
              {attachment.name}
            </a>
            <button onClick={() => removeAttachment(attachment.id)} className="text-rose-600">
              Retirer
            </button>
          </div>
        ))}
        {attachments.length === 0 && <p className="text-sm text-slate-500">Aucun fichier.</p>}
      </div>
    </div>
  );
}

function EventTimeline({ event }) {
  const history = event.history || [];

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <p className="text-sm font-semibold text-slate-900">Historique</p>
      <div className="mt-3 space-y-2">
        {history.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-900">{entry.action}</p>
            {(entry.fromStatus || entry.toStatus) && (
              <p className="text-slate-600">{`${entry.fromStatus || '-'} -> ${entry.toStatus || '-'}`}</p>
            )}
            <p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('fr-FR')}</p>
          </div>
        ))}
        {history.length === 0 && <p className="text-sm text-slate-500">Aucun historique.</p>}
      </div>
    </div>
  );
}

function EventReviewCard({ event, onSaved }) {
  const { success, error } = useToast();
  const [form, setForm] = useState({
    organizerRating: event.review?.organizerRating ? String(event.review.organizerRating) : '5',
    organizerComment: event.review?.organizerComment || '',
    staffRating: event.review?.staffRating ? String(event.review.staffRating) : '5',
    staffComment: event.review?.staffComment || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      organizerRating: event.review?.organizerRating ? String(event.review.organizerRating) : '5',
      organizerComment: event.review?.organizerComment || '',
      staffRating: event.review?.staffRating ? String(event.review.staffRating) : '5',
      staffComment: event.review?.staffComment || '',
    });
  }, [
    event.review?.organizerRating,
    event.review?.organizerComment,
    event.review?.staffRating,
    event.review?.staffComment,
  ]);

  async function submitReview(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/reviews', {
        method: event.review ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          organizerRating: Number(form.organizerRating),
          organizerComment: form.organizerComment,
          staffRating: event.assignedStaff ? Number(form.staffRating) : null,
          staffComment: event.assignedStaff ? form.staffComment : null,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        error('Avis non enregistre', data?.message || 'Erreur avis');
        return;
      }

      if (data?.review) {
        setForm({
          organizerRating: data.review.organizerRating ? String(data.review.organizerRating) : '5',
          organizerComment: data.review.organizerComment || '',
          staffRating: data.review.staffRating ? String(data.review.staffRating) : '5',
          staffComment: data.review.staffComment || '',
        });
      }

      success(event.review ? 'Avis mis a jour' : 'Avis envoye');
      await onSaved?.();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Ton avis sur la prestation</p>
          <p className="text-sm text-slate-500">
            Cet avis sera visible sur la fiche de {event.organizer?.name || "l'organisateur"}.
          </p>
        </div>
        {event.review ? (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Avis publie
          </span>
        ) : null}
      </div>

      <form onSubmit={submitReview} className="mt-4 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <label className="mb-2 block text-sm font-semibold text-slate-900">Note de l'organisateur</label>
            <select
              value={form.organizerRating}
              onChange={(e) => setForm((current) => ({ ...current, organizerRating: e.target.value }))}
              className="app-select w-full rounded-xl px-3 py-2"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value}/5
                </option>
              ))}
            </select>
            <textarea
              value={form.organizerComment}
              onChange={(e) => setForm((current) => ({ ...current, organizerComment: e.target.value }))}
              className="app-textarea mt-3 min-h-[110px] w-full rounded-xl px-3 py-2"
              placeholder="Dis ce que tu as pense de l'organisation, de la communication, de la qualite..."
            />
          </div>

          {event.assignedStaff ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="mb-2 block text-sm font-semibold text-slate-900">
                Note du staff : {event.assignedStaff.name}
              </label>
              <select
                value={form.staffRating}
                onChange={(e) => setForm((current) => ({ ...current, staffRating: e.target.value }))}
                className="app-select w-full rounded-xl px-3 py-2"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>
                    {value}/5
                  </option>
                ))}
              </select>
              <textarea
                value={form.staffComment}
                onChange={(e) => setForm((current) => ({ ...current, staffComment: e.target.value }))}
                className="app-textarea mt-3 min-h-[110px] w-full rounded-xl px-3 py-2"
                placeholder="Tu peux aussi parler de l'equipe sur place, de la ponctualite, de l'accompagnement..."
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              Aucun membre du staff n'etait assigne a cet evenement.
            </div>
          )}
        </div>

        <button type="submit" disabled={saving} className="app-button-primary rounded-xl px-4 py-3 font-semibold disabled:opacity-60">
          {saving ? 'Enregistrement...' : event.review ? 'Mettre a jour mon avis' : 'Publier mon avis'}
        </button>
      </form>
    </div>
  );
}

function StaffActionPanel({ event, onStatusUpdate, onOpenChat }) {
  const canContactClient = Boolean(event.ownerId) && !['REFUSED', 'DONE'].includes(event.status);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {(staffTransitions[event.status] || []).map(([nextStatus, label]) => (
        <button
          key={nextStatus}
          onClick={() => onStatusUpdate(event.id, nextStatus)}
          className="app-button-secondary rounded-xl px-4 py-2 text-sm font-semibold"
        >
          {label}
        </button>
      ))}

      {canContactClient && (
        <button
          onClick={() => onOpenChat(event.ownerId, event)}
          className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
        >
          Communiquer
        </button>
      )}
    </div>
  );
}

function ClientActionPanel({ event, onEdit, onDelete, onOpenChat, onOpenCart }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {['DRAFT', 'PENDING_APPROVAL'].includes(event.status) && (
        <>
          <button onClick={() => onEdit(event)} className="app-button-secondary rounded-xl px-4 py-2 text-sm font-semibold">
            Modifier
          </button>
          <button onClick={() => onDelete(event.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">
            Supprimer
          </button>
        </>
      )}

      {['DRAFT', 'PENDING_APPROVAL', 'ACCEPTED', 'PLANNED'].includes(event.status) && (
        <button onClick={() => onOpenCart(event.id)} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
          Ouvrir panier
        </button>
      )}

      {event.status === 'ACCEPTED' && (
        <button onClick={() => onOpenChat(event.ownerId, event)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
          Communiquer
        </button>
      )}
    </div>
  );
}

function EventCard({ event, isStaff, fetchEvents, onStartEditing, onDelete, onStatusUpdate, onOpenChat, onOpenCart, sessionUserId }) {
  return (
    <article className="surface-card rounded-[1.6rem] p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold text-slate-900 md:text-2xl">{event.name}</h3>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(event.status)}`}>
              {event.statusText || event.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {formatDate(event.date)} • {event.organizer?.name || 'Organisateur non defini'}
          </p>
          {isStaff ? (
            <p className="mt-2 text-sm text-slate-600">
              Client : <span className="font-medium">{event.owner?.name || event.owner?.email || 'N/A'}</span>
            </p>
          ) : null}
        </div>

        {isStaff ? (
          <StaffActionPanel event={event} onStatusUpdate={onStatusUpdate} onOpenChat={onOpenChat} />
        ) : (
          <ClientActionPanel
            event={event}
            onEdit={onStartEditing}
            onDelete={onDelete}
            onOpenChat={() => onOpenChat(sessionUserId, event)}
            onOpenCart={onOpenCart}
          />
        )}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Occasion</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{event.occasionType || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Theme</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{event.theme || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Lieu</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{event.location || '-'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Invites / budget</p>
              <p className="mt-2 text-sm font-medium text-slate-800">
                {event.guestCount ?? '-'} • {event.budget ?? '-'} EUR
              </p>
            </div>
          </div>

          {event.notes ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Notes</p>
              <p className="mt-2 text-sm leading-6 text-slate-600 whitespace-pre-wrap">{event.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">Services demandes</p>
          <div className="mt-3">
            <ServiceBadges event={event} />
          </div>
          {event.assignedStaff ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-slate-400">Staff assigne</p>
              <p className="mt-2 text-sm font-medium text-slate-800">{event.assignedStaff.name}</p>
            </div>
          ) : null}
        </div>
      </div>

      {event.status === 'DONE' && !isStaff ? <EventReviewCard event={event} onSaved={fetchEvents} /> : null}
      <EventAttachments event={event} onChanged={fetchEvents} />
      <EventTimeline event={event} />
    </article>
  );
}

function ClientReservationSection({
  editingEvent,
  currentForm,
  organizers,
  eventTemplates,
  selectedTemplateId,
  setSelectedTemplateId,
  applyTemplate,
  handleInputChange,
  handleSubmit,
  handleUpdate,
  setEditingEvent,
}) {
  const [selectedDateAvailable, setSelectedDateAvailable] = useState(true);
  const canSubmitForValidation = selectedDateAvailable || !currentForm.date;

  function selectAvailableDate(date) {
    handleInputChange({ target: { name: 'date', value: date, type: 'text' } });
    setSelectedDateAvailable(true);
  }

  async function checkTypedDate(date, eventTime) {
    if (!currentForm.organizerId || !date || !eventTime) {
      setSelectedDateAvailable(true);
      return;
    }

    try {
      const res = await fetch(`/api/event-availability?organizerId=${currentForm.organizerId}&start=${date}&days=1&time=${eventTime}`);
      const data = await res.json();
      setSelectedDateAvailable(Boolean(data.days?.[0]?.available));
    } catch {
      setSelectedDateAvailable(true);
    }
  }

  useEffect(() => {
    checkTypedDate(currentForm.date, currentForm.eventTime);
  }, [currentForm.organizerId, currentForm.date, currentForm.eventTime]);

  return (
    <section className="space-y-6">
      <div className="page-section p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="app-stat-badge">Reservation guidee</span>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">Creer / gerer mon evenement</h2>
            <p className="mt-2 text-slate-600">
              Choisis ton organisateur, decris ton besoin, puis soumets ta demande. Le parcours reste simple et progressif.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Etape 1</p>
              <p className="mt-2 text-sm font-medium text-slate-700">Choisir l'organisateur</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Etape 2</p>
              <p className="mt-2 text-sm font-medium text-slate-700">Preciser l'evenement</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Etape 3</p>
              <p className="mt-2 text-sm font-medium text-slate-700">Soumettre et suivre</p>
            </div>
          </div>
        </div>
      </div>

      {eventTemplates.length > 0 && !editingEvent ? (
        <div className="page-section p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Templates avec suggestions auto</h3>
              <p className="mt-1 text-sm text-slate-500">Gagne du temps avec un point de depart adapte a ton occasion.</p>
            </div>
            <div className="w-full md:w-[420px]">
              <select
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value);
                  applyTemplate(e.target.value);
                }}
                className="app-select w-full rounded-2xl px-4 py-3"
              >
                <option value="">Choisir un template</option>
                {eventTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.occasionType}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={editingEvent ? handleUpdate : handleSubmit} className="surface-card rounded-[1.6rem] p-6 md:p-7">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              {editingEvent ? "Modifier l'evenement" : 'Nouvelle demande'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Remplis l'essentiel. Tu pourras toujours affiner ensuite.
            </p>
          </div>
          {editingEvent ? (
            <span className="app-stat-badge">Edition en cours</span>
          ) : null}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Organisateur</label>
              <select
                name="organizerId"
                value={currentForm.organizerId}
                onChange={handleInputChange}
                className="app-select w-full rounded-2xl px-4 py-3"
                required
              >
                <option value="">Choisir un organisateur</option>
                {organizers.map((organizer) => (
                  <option key={organizer.id} value={organizer.id}>
                    {organizer.name}{organizer.city ? ` - ${organizer.city}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Nom de l'evenement</label>
                <input type="text" name="name" value={currentForm.name} onChange={handleInputChange} className="app-input w-full rounded-2xl px-4 py-3" required placeholder="Anniversaire de Sara" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Date</label>
                <input type="date" name="date" value={currentForm.date} onChange={handleInputChange} className="app-input w-full rounded-2xl px-4 py-3" required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Heure de l'evenement</label>
                <input type="time" name="eventTime" value={currentForm.eventTime} onChange={handleInputChange} className="app-input w-full rounded-2xl px-4 py-3" required />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Type d'occasion</label>
                <select name="occasionType" value={currentForm.occasionType} onChange={handleInputChange} className="app-select w-full rounded-2xl px-4 py-3">
                  <option value="">Choisir</option>
                  <option value="Anniversaire">Anniversaire</option>
                  <option value="Mariage">Mariage</option>
                  <option value="Fiancailles">Fiancailles</option>
                  <option value="Naissance">Naissance</option>
                  <option value="Baby shower">Baby shower</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Theme</label>
                <input type="text" name="theme" value={currentForm.theme} onChange={handleInputChange} className="app-input w-full rounded-2xl px-4 py-3" placeholder="Rose gold, boheme, oriental..." />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Lieu</label>
                <input type="text" name="location" value={currentForm.location} onChange={handleInputChange} className="app-input w-full rounded-2xl px-4 py-3" placeholder="Paris, salle des fetes..." />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">Nombre d'invites</label>
                <input type="number" name="guestCount" value={currentForm.guestCount} onChange={handleInputChange} className="app-input w-full rounded-2xl px-4 py-3" placeholder="50" min="1" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">Budget (EUR)</label>
                <input type="number" step="0.01" name="budget" value={currentForm.budget} onChange={handleInputChange} className="app-input w-full rounded-2xl px-4 py-3" placeholder="1000" min="0" />
              </div>
            </div>

            <AvailabilityPicker
              organizerId={currentForm.organizerId}
              selectedDate={currentForm.date}
              selectedTime={currentForm.eventTime}
              onSelectDate={selectAvailableDate}
            />

            {!selectedDateAvailable && currentForm.date ? (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                Ce creneau horaire est deja reserve ou bloque pour cet organisateur. Choisis une autre heure ou une autre date.
              </p>
            ) : null}
          </div>

          <div className="space-y-5">
            <div className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Services souhaites</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {serviceOptions.map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-700">
                    <input type="checkbox" name={key} checked={currentForm[key]} onChange={handleInputChange} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Notes complementaires</label>
              <textarea
                name="notes"
                value={currentForm.notes}
                onChange={handleInputChange}
                className="app-textarea min-h-[160px] w-full rounded-2xl px-4 py-3"
                placeholder="Decris ce que tu veux, les couleurs, l'ambiance, les contraintes..."
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 md:flex-row">
          <button type="submit" value="draft" className="app-button-secondary w-full rounded-2xl px-6 py-3 font-bold md:w-auto">
            Enregistrer brouillon
          </button>
          <button type="submit" value="submit" disabled={!canSubmitForValidation} className="app-button-primary w-full rounded-2xl px-6 py-3 font-bold disabled:cursor-not-allowed disabled:opacity-50 md:w-auto">
            Soumettre pour validation
          </button>
          {editingEvent ? (
            <button type="button" className="app-button-secondary w-full rounded-2xl px-6 py-3 font-semibold md:w-auto" onClick={() => setEditingEvent(null)}>
              Annuler
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function StaffEventSection({ events, fetchEvents, onStatusUpdate, onOpenChat, statusFilter, onStatusFilterChange }) {
  const pending = events.filter((event) => event.status === 'PENDING_APPROVAL').length;
  const accepted = events.filter((event) => event.status === 'ACCEPTED').length;
  const planned = events.filter((event) => event.status === 'PLANNED').length;
  const done = events.filter((event) => event.status === 'DONE').length;
  const filteredEvents = events.filter((event) => {
    if (statusFilter === 'PENDING_APPROVAL') return event.status === 'PENDING_APPROVAL';
    if (statusFilter === 'IN_PROGRESS') return ['ACCEPTED', 'PLANNED'].includes(event.status);
    if (statusFilter && statusFilter !== 'ALL') return event.status === statusFilter;
    return true;
  });
  const filters = [
    ['ALL', 'Tous'],
    ['PENDING_APPROVAL', 'A accepter'],
    ['IN_PROGRESS', 'En cours'],
    ['PLANNED', 'Planifies'],
    ['DONE', 'Termines'],
  ];

  return (
    <section className="space-y-6">
      <div className="page-section p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="app-stat-badge">Pilotage operationnel</span>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">Demandes d'evenements</h2>
            <p className="mt-2 text-slate-600">
              Accepte rapidement, planifie et garde une vue nette sur les demandes clients.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <StatCard label="En attente" value={pending} accent="warm" />
            <StatCard label="Acceptes" value={accepted} accent="green" />
            <StatCard label="Planifies" value={planned} accent="primary" />
            <StatCard label="Termines" value={done} accent="pink" />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onStatusFilterChange(value)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              statusFilter === value
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            isStaff
            fetchEvents={fetchEvents}
            onStatusUpdate={onStatusUpdate}
            onOpenChat={onOpenChat}
          />
        ))}

        {filteredEvents.length === 0 ? (
          <div className="page-section p-8 text-center text-slate-500">Aucune demande.</div>
        ) : null}
      </div>
    </section>
  );
}

export default function Events() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const isStaff = ['PLATFORM_ADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(role);
  const { success, error, info } = useToast();

  const [events, setEvents] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [eventTemplates, setEventTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [newEvent, setNewEvent] = useState(initialEventState);
  const [editingEvent, setEditingEvent] = useState(null);
  const [chatModalIsOpen, setChatModalIsOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedCartEventId, setSelectedCartEventId] = useState(null);
  const [staffStatusFilter, setStaffStatusFilter] = useState('ALL');
  const cartSectionRef = useRef(null);

  async function fetchEvents() {
    if (status !== 'authenticated') return;
    const res = await fetch('/api/events');
    if (!res.ok) {
      console.error('Failed to fetch events', await res.text());
      return;
    }
    const data = await res.json();
    setEvents(data.events || []);
  }

  useEffect(() => {
    fetchEvents();
  }, [status]);

  useEffect(() => {
    if (!isStaff || typeof window === 'undefined') return;

    const pendingFilter = window.localStorage.getItem('easy-event:eventStatusFilter');
    if (pendingFilter) {
      setStaffStatusFilter(pendingFilter);
      window.localStorage.removeItem('easy-event:eventStatusFilter');
    }
  }, [isStaff]);

  useEffect(() => {
    if (status !== 'authenticated' || isStaff) return;

    fetch('/api/organizers')
      .then((res) => res.json())
      .then((data) => setOrganizers(data.organizers || []))
      .catch(() => setOrganizers([]));

    fetch('/api/event-templates')
      .then((res) => res.json())
      .then((data) => setEventTemplates(data.templates || []))
      .catch(() => setEventTemplates([]));
  }, [status, isStaff]);

  useEffect(() => {
    if (isStaff || typeof window === 'undefined') return;

    const pendingOrganizerId = window.localStorage.getItem('selectedOrganizerId');
    if (!pendingOrganizerId) return;

    setNewEvent((current) => ({
      ...current,
      organizerId: current.organizerId || pendingOrganizerId,
    }));

    window.localStorage.removeItem('selectedOrganizerId');
  }, [isStaff]);

  function handleInputChange(e) {
    const { name, value, type, checked } = e.target;
    const nextValue = type === 'checkbox' ? checked : value;

    if (editingEvent) {
      setEditingEvent((prev) => ({ ...prev, [name]: nextValue }));
      return;
    }

    setNewEvent((prev) => ({ ...prev, [name]: nextValue }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const submit = e.nativeEvent?.submitter?.value === 'submit';

    if (status !== 'authenticated' || isStaff) {
      error('Creation impossible', "Tu n'es pas autorisee a creer un evenement.");
      return;
    }

    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newEvent, submit }),
    });

    const text = await res.text();
    if (!res.ok) {
      error('Enregistrement impossible', text);
      return;
    }

    const created = JSON.parse(text);
    setEvents([created, ...events]);
    setNewEvent(initialEventState);
    setSelectedTemplateId('');
    openCart(created.id);
    success(submit ? 'Evenement soumis' : 'Brouillon enregistre');
  }

  async function handleUpdate(e) {
    e.preventDefault();
    const submit = e.nativeEvent?.submitter?.value === 'submit';
    if (status !== 'authenticated' || isStaff) return;

    const res = await fetch('/api/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editingEvent, submit }),
    });

    const text = await res.text();
    if (!res.ok) {
      error('Mise a jour impossible', text);
      return;
    }

    const updated = JSON.parse(text);
    setEvents(events.map((event) => (event.id === updated.id ? updated : event)));
    setEditingEvent(null);
    success('Evenement mis a jour');
  }

  async function handleDelete(id) {
    if (status !== 'authenticated' || isStaff) return;

    const res = await fetch('/api/events', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (!res.ok && res.status !== 204) {
      error('Suppression impossible', await res.text());
      return;
    }

    setEvents(events.filter((event) => event.id !== id));
    if (selectedCartEventId === id) setSelectedCartEventId(null);
    info('Evenement supprime');
  }

  async function handleStatusUpdate(id, nextStatus) {
    if (!isStaff) return;

    const res = await fetch('/api/events', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: nextStatus }),
    });

    if (!res.ok) {
      error('Statut non modifie', await res.text());
      return;
    }

    await fetchEvents();
    success('Statut mis a jour');
  }

  function openChatModal(clientId, event) {
    setSelectedClientId(clientId);
    setSelectedEvent(event);
    setChatModalIsOpen(true);
  }

  function closeChatModal() {
    setChatModalIsOpen(false);
    setSelectedClientId(null);
    setSelectedEvent(null);
  }

  function updateStaffStatusFilter(filter) {
    setStaffStatusFilter(filter || 'ALL');
  }

  function startEditing(event) {
    setEditingEvent({
      ...event,
      organizerId: event.organizerId ?? '',
      date: event.date ? String(event.date).slice(0, 10) : '',
      eventTime: event.date ? timeValue(event.date) : '',
      guestCount: event.guestCount ?? '',
      budget: event.budget ?? '',
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openCart(eventId) {
    if (!eventId) {
      setSelectedCartEventId(null);
      return;
    }

    setSelectedCartEventId(eventId);
    setTimeout(() => {
      cartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  function applyTemplate(templateId) {
    const template = eventTemplates.find((item) => String(item.id) === String(templateId));
    if (!template) return;

    setNewEvent((current) => ({
      ...current,
      name: current.name || template.name,
      occasionType: template.occasionType || current.occasionType,
      theme: template.theme || current.theme,
      guestCount: template.guestCount ?? current.guestCount,
      budget: template.budget ?? current.budget,
      notes: template.description || current.notes,
      serviceBuffet: template.serviceBuffet,
      serviceDeco: template.serviceDeco,
      serviceOrganisation: template.serviceOrganisation,
      serviceGateaux: template.serviceGateaux,
      serviceMobilier: template.serviceMobilier,
      serviceAnimation: template.serviceAnimation,
      serviceLieu: template.serviceLieu,
    }));
  }

  const currentForm = editingEvent || newEvent;
  const clientBookingEvents = useMemo(
    () => events.filter((event) => ['DRAFT', 'PENDING_APPROVAL', 'ACCEPTED', 'PLANNED'].includes(event.status)),
    [events]
  );
  const nextClientEvent = events.find((event) => ['DRAFT', 'PENDING_APPROVAL', 'ACCEPTED', 'PLANNED'].includes(event.status));
  const selectedCartEvent = clientBookingEvents.find((event) => String(event.id) === String(selectedCartEventId));

  if (status === 'loading') {
    return <div className="p-8 text-center text-slate-500">Chargement...</div>;
  }

  if (status === 'unauthenticated') {
    return <div className="p-8 text-center text-slate-500">Connecte-toi pour gerer tes evenements.</div>;
  }

  if (isStaff) {
    return (
      <>
        <StaffEventSection
          events={events}
          fetchEvents={fetchEvents}
          onStatusUpdate={handleStatusUpdate}
          onOpenChat={openChatModal}
          statusFilter={staffStatusFilter}
          onStatusFilterChange={updateStaffStatusFilter}
        />

        <Modal isOpen={chatModalIsOpen} onRequestClose={closeChatModal} style={customStyles} contentLabel="Chat">
          <div className="flex items-center justify-between border-b p-4">
            <h2 className="text-xl font-bold text-slate-900">
              Chat avec {selectedEvent?.owner?.name || selectedEvent?.owner?.email}
            </h2>
            <button onClick={closeChatModal} className="text-3xl text-slate-500 hover:text-slate-800">
              &times;
            </button>
          </div>
          {selectedClientId ? (
            <div className="h-[calc(85vh-64px)] p-4">
              <Chat clientId={selectedClientId} />
            </div>
          ) : null}
        </Modal>
      </>
    );
  }

  return (
    <div className="space-y-8">
      <ClientReservationSection
        editingEvent={editingEvent}
        currentForm={currentForm}
        organizers={organizers}
        eventTemplates={eventTemplates}
        selectedTemplateId={selectedTemplateId}
        setSelectedTemplateId={setSelectedTemplateId}
        applyTemplate={applyTemplate}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        handleUpdate={handleUpdate}
        setEditingEvent={setEditingEvent}
      />

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Mes evenements" value={events.length} accent="primary" />
        <StatCard
          label="En cours"
          value={clientBookingEvents.length}
          helper="Demandes modifiables ou en suivi"
          accent="green"
        />
        <StatCard
          label="Prochain"
          value={nextClientEvent?.name || '-'}
          helper={nextClientEvent?.date ? formatDate(nextClientEvent.date) : 'Aucun suivi actif'}
          accent="warm"
        />
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div ref={cartSectionRef} className="surface-card rounded-[1.6rem] p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Panier et reservation</h3>
              <p className="mt-1 text-sm text-slate-500">
                Selectionne l'evenement a completer pour ajouter des produits et preparer la commande.
              </p>
            </div>
            <span className="app-stat-badge">{clientBookingEvents.length} evenement(s) reservable(s)</span>
          </div>

          <div className="mt-4">
            <select
              value={selectedCartEventId || ''}
              onChange={(e) => openCart(e.target.value ? Number(e.target.value) : null)}
              className="app-select w-full rounded-2xl px-4 py-3 md:max-w-[460px]"
            >
              <option value="">Selectionner un evenement</option>
              {clientBookingEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} - {formatDate(event.date)}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-5">
            <EventCart eventId={selectedCartEventId} event={selectedCartEvent} />
          </div>
        </div>

        <div className="page-section p-6">
          <h3 className="text-xl font-bold text-slate-900">Comment avancer facilement ?</h3>
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">1. Cree ou mets a jour ta demande</p>
              <p className="mt-2 text-sm text-slate-500">Commence par les infos essentielles, puis enregistre en brouillon si besoin.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">2. Soumets pour validation</p>
              <p className="mt-2 text-sm text-slate-500">L'organisateur et son equipe peuvent ensuite accepter, refuser ou planifier.</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">3. Ouvre le panier</p>
              <p className="mt-2 text-sm text-slate-500">Ajoute les prestations, la livraison, l'installation et laisse tes notes.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Mes demandes</h3>
            <p className="mt-1 text-sm text-slate-500">Suis l'avancement, echange avec l'equipe et complete ta reservation.</p>
          </div>
          <span className="app-stat-badge">{events.length} fiche(s)</span>
        </div>

        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            isStaff={false}
            fetchEvents={fetchEvents}
            onStartEditing={startEditing}
            onDelete={handleDelete}
            onOpenChat={openChatModal}
            onOpenCart={openCart}
            sessionUserId={session.user.id}
          />
        ))}

        {events.length === 0 ? (
          <div className="page-section p-8 text-center text-slate-500">Aucun evenement.</div>
        ) : null}
      </section>

      <Modal isOpen={chatModalIsOpen} onRequestClose={closeChatModal} style={customStyles} contentLabel="Chat admin">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-xl font-bold text-slate-900">Chat avec l'equipe</h2>
          <button onClick={closeChatModal} className="text-3xl text-slate-500 hover:text-slate-800">
            &times;
          </button>
        </div>
        {session?.user?.id ? (
          <div className="h-[calc(85vh-64px)] p-4">
            <Chat clientId={session.user.id} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
