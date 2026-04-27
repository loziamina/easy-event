import useSWR from 'swr';
import { useMemo, useState } from 'react';
import { useToast } from './ToastProvider';

const fetcher = (url) => fetch(url).then((res) => res.json());

const emptyBlock = { title: '', startAt: '', endAt: '', reason: '' };
const emptyTask = { title: '', category: 'Installation', dueAt: '', assignedToId: '' };

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const next = new Date(date);
  const day = next.getDay() || 7;
  next.setDate(next.getDate() - day + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function viewRange(anchor, view) {
  const date = new Date(anchor);
  if (view === 'day') {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return { start, end: addDays(start, 1) };
  }
  if (view === 'week') {
    const start = startOfWeek(date);
    return { start, end: addDays(start, 7) };
  }
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start, end };
}

function daysInRange(start, end) {
  const days = [];
  for (let current = new Date(start); current < end; current = addDays(current, 1)) {
    days.push(new Date(current));
  }
  return days;
}

function conflictFor(conflicts, eventId) {
  return conflicts.find((item) => item.eventId === eventId);
}

function statusTone(status) {
  const map = {
    ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    PLANNED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    DONE: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  return map[status] || 'bg-slate-100 text-slate-700 border-slate-200';
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

function ChecklistBoard({ event, staff, onBack, onMutate, onAssignEvent }) {
  const [task, setTask] = useState(emptyTask);
  const [editingId, setEditingId] = useState(null);
  const [editingDraft, setEditingDraft] = useState(emptyTask);
  const { success, error, info } = useToast();
  const checklist = event.checklist || [];
  const assignedMember = staff.find((member) => String(member.id) === String(event.assignedStaffId || ''));

  function staffName(id) {
    return staff.find((member) => member.id === id)?.name || staff.find((member) => member.id === id)?.email || 'Non assigne';
  }

  async function addTask(e) {
    e.preventDefault();
    const res = await fetch(`/api/events/${event.id}/checklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (res.ok) {
      setTask(emptyTask);
      onMutate();
      success('Tache ajoutee');
    } else {
      error('Checklist impossible', await res.text());
    }
  }

  async function saveTask(itemId, patch) {
    const res = await fetch(`/api/events/${event.id}/checklist`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, ...patch }),
    });
    if (res.ok) {
      onMutate();
      return true;
    }
    error('Mise a jour impossible', await res.text());
    return false;
  }

  async function toggleTask(item) {
    const ok = await saveTask(item.id, { isDone: !item.isDone });
    if (ok) info(item.isDone ? 'Tache reouverte' : 'Tache terminee');
  }

  async function deleteTask(id) {
    const res = await fetch(`/api/events/${event.id}/checklist`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      onMutate();
      info('Tache supprimee');
    } else {
      error('Suppression impossible', await res.text());
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditingDraft({
      title: item.title || '',
      category: item.category || 'Installation',
      dueAt: item.dueAt ? new Date(item.dueAt).toISOString().slice(0, 16) : '',
      assignedToId: item.assignedToId ? String(item.assignedToId) : '',
    });
  }

  async function submitEdit(itemId) {
    const ok = await saveTask(itemId, editingDraft);
    if (ok) {
      success('Tache mise a jour');
      setEditingId(null);
      setEditingDraft(emptyTask);
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <button type="button" onClick={onBack} className="mb-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50">
            Retour au planning
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-3xl font-bold text-slate-900">{event.name}</h2>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(event.status)}`}>
              {event.statusText || event.status}
            </span>
          </div>
          <p className="mt-2 text-slate-500">
            {new Date(event.date).toLocaleDateString('fr-FR')} • {event.location || 'Lieu a confirmer'} • Client : {event.owner?.name || event.owner?.email}
          </p>
        </div>
        <div className="min-w-[260px] rounded-[1.3rem] border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Responsable principal</p>
          <select
            className="app-select mt-3 w-full rounded-xl px-4 py-3"
            value={event.assignedStaffId || ''}
            onChange={(e) => onAssignEvent(event.id, e.target.value)}
          >
            <option value="">Assigner un staff</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>{member.name || member.email}</option>
            ))}
          </select>
          <p className="mt-3 text-sm text-slate-500">
            {assignedMember ? `Affecte a ${assignedMember.name || assignedMember.email}` : 'Aucun responsable principal assigne'}
          </p>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Taches" value={checklist.length} accent="primary" />
        <StatCard label="Terminees" value={checklist.filter((item) => item.isDone).length} accent="green" />
        <StatCard label="En attente" value={checklist.filter((item) => !item.isDone).length} accent="warm" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <form onSubmit={addTask} className="surface-card rounded-[1.6rem] p-6 space-y-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Ajouter une tache</h3>
            <p className="mt-1 text-sm text-slate-500">Prepare le jour J en assignant clairement chaque action.</p>
          </div>
          <input className="app-input w-full rounded-xl px-4 py-3" placeholder="Nom de la tache" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />
          <select className="app-select w-full rounded-xl px-4 py-3" value={task.category} onChange={(e) => setTask({ ...task, category: e.target.value })}>
            <option>Installation</option>
            <option>Materiel</option>
            <option>Buffet</option>
            <option>Decoration</option>
            <option>Animation</option>
          </select>
          <input className="app-input w-full rounded-xl px-4 py-3" type="datetime-local" value={task.dueAt} onChange={(e) => setTask({ ...task, dueAt: e.target.value })} />
          <select className="app-select w-full rounded-xl px-4 py-3" value={task.assignedToId} onChange={(e) => setTask({ ...task, assignedToId: e.target.value })}>
            <option value="">Responsable</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>{member.name || member.email}</option>
            ))}
          </select>
          <button className="app-button-primary rounded-xl px-5 py-3 font-semibold">Ajouter</button>
        </form>

        <div className="surface-card rounded-[1.6rem] p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Checklist detaillee</h3>
              <p className="mt-1 text-sm text-slate-500">Le staff retrouve ici exactement ce qu’il doit preparer.</p>
            </div>
            <span className="app-stat-badge">{checklist.length} tache(s)</span>
          </div>

          <div className="mt-5 space-y-3">
            {checklist.map((item) => (
              <div key={item.id} className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
                {editingId === item.id ? (
                  <div className="space-y-3">
                    <input className="app-input w-full rounded-xl px-4 py-3" value={editingDraft.title} onChange={(e) => setEditingDraft({ ...editingDraft, title: e.target.value })} />
                    <div className="grid gap-3 md:grid-cols-3">
                      <select className="app-select rounded-xl px-4 py-3" value={editingDraft.category} onChange={(e) => setEditingDraft({ ...editingDraft, category: e.target.value })}>
                        <option>Installation</option>
                        <option>Materiel</option>
                        <option>Buffet</option>
                        <option>Decoration</option>
                        <option>Animation</option>
                      </select>
                      <input className="app-input rounded-xl px-4 py-3" type="datetime-local" value={editingDraft.dueAt} onChange={(e) => setEditingDraft({ ...editingDraft, dueAt: e.target.value })} />
                      <select className="app-select rounded-xl px-4 py-3" value={editingDraft.assignedToId} onChange={(e) => setEditingDraft({ ...editingDraft, assignedToId: e.target.value })}>
                        <option value="">Responsable</option>
                        {staff.map((member) => (
                          <option key={member.id} value={member.id}>{member.name || member.email}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => submitEdit(item.id)} className="app-button-primary rounded-xl px-4 py-2 font-semibold">Enregistrer</button>
                      <button type="button" onClick={() => setEditingId(null)} className="app-button-secondary rounded-xl px-4 py-2 font-semibold">Annuler</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <label className="flex items-start gap-3">
                      <input type="checkbox" checked={item.isDone} onChange={() => toggleTask(item)} className="mt-1 h-4 w-4 rounded border-slate-300 text-[color:var(--primary-soft)]" />
                      <span>
                        <span className={`block text-sm font-semibold ${item.isDone ? 'line-through text-slate-400' : 'text-slate-900'}`}>{item.title}</span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {item.category || 'Sans categorie'}
                          {item.dueAt ? ` • ${new Date(item.dueAt).toLocaleString('fr-FR')}` : ''}
                          {item.assignedToId ? ` • ${staffName(item.assignedToId)}` : ''}
                        </span>
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEdit(item)} className="app-button-secondary rounded-xl px-3 py-2 text-xs font-semibold">Modifier</button>
                      <button type="button" onClick={() => deleteTask(item.id)} className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Supprimer</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {checklist.length === 0 ? (
              <div className="rounded-[1.2rem] border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                Aucune tache pour le moment.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Planning() {
  const [view, setView] = useState('week');
  const [anchor, setAnchor] = useState(isoDate(new Date()));
  const [block, setBlock] = useState(emptyBlock);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const { success, error, info } = useToast();

  const range = useMemo(() => viewRange(anchor, view), [anchor, view]);
  const query = `/api/planning?start=${range.start.toISOString()}&end=${range.end.toISOString()}`;
  const { data, mutate } = useSWR(query, fetcher);

  const events = data?.events || [];
  const blocks = data?.blocks || [];
  const staff = data?.staff || [];
  const conflicts = data?.conflicts || [];
  const days = daysInRange(range.start, range.end);
  const eventMap = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const selectedEvent = selectedEventId ? eventMap.get(Number(selectedEventId)) : null;

  async function assignEvent(eventId, assignedStaffId) {
    const res = await fetch('/api/planning', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId, assignedStaffId }),
    });
    if (res.ok) {
      mutate();
      success('Assignation mise a jour');
    } else {
      error('Assignation impossible', await res.text());
    }
  }

  async function addBlock(e) {
    e.preventDefault();
    const res = await fetch('/api/planning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(block),
    });
    if (res.ok) {
      setBlock(emptyBlock);
      mutate();
      success('Creneau bloque');
    } else {
      error('Blocage impossible', await res.text());
    }
  }

  async function deleteBlock(id) {
    const res = await fetch('/api/planning', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      mutate();
      info('Bloc retire');
    }
  }

  function eventsForDay(day) {
    return events.filter((event) => isoDate(new Date(event.date)) === isoDate(day));
  }

  function blocksForDay(day) {
    return blocks.filter((item) => isoDate(new Date(item.startAt)) === isoDate(day));
  }

  if (selectedEvent) {
    return (
      <ChecklistBoard
        event={selectedEvent}
        staff={staff}
        onBack={() => setSelectedEventId(null)}
        onMutate={mutate}
        onAssignEvent={assignEvent}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="page-section p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="app-stat-badge">Pilotage planning</span>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">Planning & organisation</h2>
            <p className="mt-2 text-slate-600">Clique sur un evenement reserve pour ouvrir sa checklist detaillee et organiser l’equipe.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {['day', 'week', 'month'].map((mode) => (
              <button
                key={mode}
                onClick={() => setView(mode)}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold ${view === mode ? 'text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                style={view === mode ? { background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-sm)' } : undefined}
              >
                {mode === 'day' ? 'Jour' : mode === 'week' ? 'Semaine' : 'Mois'}
              </button>
            ))}
            <input className="app-input rounded-2xl px-4 py-2" type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
          </div>
        </div>
      </div>

      <form onSubmit={addBlock} className="surface-card rounded-[24px] grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1.4fr_220px_220px_1fr_auto]">
        <input className="app-input rounded-2xl px-4 py-3" placeholder="Bloquer un creneau" value={block.title} onChange={(e) => setBlock({ ...block, title: e.target.value })} />
        <input className="app-input rounded-2xl px-4 py-3" type="datetime-local" value={block.startAt} onChange={(e) => setBlock({ ...block, startAt: e.target.value })} />
        <input className="app-input rounded-2xl px-4 py-3" type="datetime-local" value={block.endAt} onChange={(e) => setBlock({ ...block, endAt: e.target.value })} />
        <input className="app-input rounded-2xl px-4 py-3" placeholder="Raison" value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} />
        <button className="rounded-2xl px-5 py-3 font-semibold text-white" style={{ background: 'var(--gradient-warm)', boxShadow: 'var(--shadow-sm)' }}>
          Bloquer
        </button>
      </form>

      <div className={`grid gap-4 ${view === 'month' ? 'md:grid-cols-7' : 'md:grid-cols-1'}`}>
        {days.map((day) => (
          <div key={day.toISOString()} className="surface-card min-h-[200px] rounded-[24px] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="font-bold text-slate-900">{day.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}</div>
              <span className="text-xs text-slate-400">{eventsForDay(day).length + blocksForDay(day).length} element(s)</span>
            </div>

            <div className="space-y-3">
              {blocksForDay(day).map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    if (item.eventId) setSelectedEventId(item.eventId);
                  }}
                  className={`${item.eventId ? 'cursor-pointer border-emerald-200 bg-emerald-50/90 hover:bg-emerald-100/90' : 'border-amber-200 bg-amber-50/90'} rounded-2xl border p-3 text-sm transition`}
                >
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className={`${item.eventId ? 'text-emerald-800' : 'text-amber-800'} font-semibold`}>{item.title}</p>
                      <p className={`${item.eventId ? 'text-emerald-700' : 'text-amber-700'} mt-1 text-xs`}>
                        {new Date(item.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {item.eventId ? (
                      <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold text-emerald-700">Checklist</span>
                    ) : (
                      <button type="button" className="text-xs font-semibold text-amber-800" onClick={(e) => { e.stopPropagation(); deleteBlock(item.id); }}>Retirer</button>
                    )}
                  </div>
                  {item.reason ? <p className={`${item.eventId ? 'text-emerald-700' : 'text-amber-700'} mt-2 text-xs`}>{item.reason}</p> : null}
                </div>
              ))}

              {eventsForDay(day).map((event) => {
                const conflict = conflictFor(conflicts, event.id);
                return (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full rounded-2xl border p-4 text-left text-sm transition hover:-translate-y-[1px] ${conflict?.hasConflict ? 'border-amber-300 bg-amber-50 hover:bg-amber-100' : 'border-slate-200 bg-white/80 hover:border-indigo-200 hover:bg-indigo-50/40'}`}
                  >
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <p className="font-bold text-slate-900">{event.name}</p>
                        <p className="mt-1 text-slate-500">{event.location || 'Lieu a confirmer'}</p>
                        <p className="text-slate-500">Client: {event.owner?.name || event.owner?.email}</p>
                        <p className="mt-2 text-xs text-slate-500">{event.checklist?.length || 0} tache(s)</p>
                        {conflict?.hasConflict ? <p className="mt-2 text-xs font-semibold text-amber-800">Conflit detecte sur cette journee</p> : null}
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(event.status)}`}>{event.statusText || event.status}</span>
                    </div>
                  </button>
                );
              })}

              {eventsForDay(day).length === 0 && blocksForDay(day).length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-400">Libre</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
