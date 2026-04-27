import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { useToast } from './ToastProvider';

const fetcher = (url) => fetch(url).then((res) => res.json());

const emptyTemplate = {
  name: '',
  description: '',
  calculationMode: 'MIXED',
  defaultDeposit: '',
  terms: '',
};

const emptyQuoteForm = {
  eventId: '',
  templateId: '',
  calculationMode: 'MIXED',
  deliveryFee: '0',
  installationFee: '0',
  discount: '0',
  depositAmount: '',
  depositRequired: false,
  terms: '',
  send: true,
};

function money(value) {
  return Number(value || 0).toLocaleString('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  });
}

function statusLabel(status) {
  const labels = {
    DRAFT: 'Brouillon',
    SENT: 'Envoye',
    ACCEPTED: 'Accepte',
    REFUSED: 'Refuse',
  };
  return labels[status] || status;
}

function statusTone(status) {
  const map = {
    DRAFT: 'bg-slate-100 text-slate-700 border-slate-200',
    SENT: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REFUSED: 'bg-rose-50 text-rose-700 border-rose-200',
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

function SummaryLine({ label, value, strong = false, accent = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${strong ? 'border-t border-slate-200 pt-3 text-base font-bold text-slate-900' : 'text-sm text-slate-600'} ${accent ? 'font-semibold text-indigo-700' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function QuotePreview({ quote, isStaff, onSend, onDelete, onDecision }) {
  const [comment, setComment] = useState('');

  return (
    <article className="surface-card overflow-hidden rounded-[1.6rem]">
      <div className="border-b border-slate-200 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900 md:text-2xl">{quote.number}</h3>
            <p className="mt-2 text-sm text-slate-500">
              {quote.event?.name} - {quote.event?.owner?.name || quote.event?.owner?.email}
            </p>
            <p className="mt-1 text-sm text-slate-500">Mode: {quote.calculationMode}</p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusTone(quote.status)}`}>
            {statusLabel(quote.status)}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="overflow-x-auto rounded-[1.2rem] border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Prestation</th>
                <th className="px-4 py-3">Strategie</th>
                <th className="px-4 py-3 text-right">Qte</th>
                <th className="px-4 py-3 text-right">PU</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{item.label}</p>
                    {item.description ? <p className="mt-1 text-slate-500">{item.description}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{item.strategy}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{item.unitPrice == null ? 'Sur devis' : money(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">{item.lineTotal == null ? 'Sur devis' : money(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {quote.terms ? (
              <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="mb-2 font-semibold text-slate-900">Conditions</p>
                <p className="whitespace-pre-wrap">{quote.terms}</p>
              </div>
            ) : null}

            {quote.clientComment ? (
              <div className="rounded-[1.2rem] border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
                <p className="mb-2 font-semibold">Commentaire client</p>
                <p className="whitespace-pre-wrap">{quote.clientComment}</p>
              </div>
            ) : null}
          </div>

          <div className="rounded-[1.3rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="text-lg font-bold text-slate-900">Recapitulatif</h4>
            <div className="mt-4 space-y-3">
              <SummaryLine label="Sous-total" value={money(quote.subtotal)} />
              <SummaryLine label="Frais de livraison" value={money(quote.deliveryFee)} />
              <SummaryLine label="Frais d'installation" value={money(quote.installationFee)} />
              <SummaryLine label="Remise commerciale" value={quote.discount ? `-${money(quote.discount)}` : money(0)} />
              <SummaryLine label="Total" value={money(quote.total)} strong />
              {quote.depositRequired ? (
                <SummaryLine label="Acompte a regler" value={money(quote.depositAmount)} accent />
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 print:hidden">
          <button onClick={() => window.print()} className="app-button-secondary rounded-xl px-4 py-2 font-semibold">
            Imprimer
          </button>

          {isStaff ? (
            <>
              {quote.status === 'DRAFT' ? (
                <button onClick={() => onSend(quote.id)} className="app-button-primary rounded-xl px-4 py-2 font-semibold">
                  Envoyer
                </button>
              ) : null}
              <button onClick={() => onDelete(quote.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 font-semibold text-rose-700 hover:bg-rose-100">
                Supprimer
              </button>
            </>
          ) : quote.status === 'SENT' ? (
            <div className="w-full space-y-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4">
              <textarea
                className="app-textarea min-h-[90px] w-full rounded-xl px-3 py-2"
                rows="2"
                placeholder="Commentaire optionnel"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onDecision(quote.id, 'accept', comment)} className="rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
                  Accepter
                </button>
                <button onClick={() => onDecision(quote.id, 'refuse', comment)} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 font-semibold text-rose-700 hover:bg-rose-100">
                  Refuser
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function Quotes() {
  const { data: session } = useSession();
  const isStaff = ['PLATFORM_ADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(session?.user?.role);
  const { data, mutate } = useSWR('/api/quotes', fetcher);
  const { data: eventsData } = useSWR(isStaff ? '/api/events' : null, fetcher);
  const { data: templatesData, mutate: mutateTemplates } = useSWR('/api/quote-templates', fetcher);

  const quotes = data?.quotes || [];
  const templates = templatesData?.templates || [];
  const events = useMemo(() => {
    return (eventsData?.events || []).filter((event) => ['ACCEPTED', 'PLANNED', 'DONE'].includes(event.status));
  }, [eventsData]);

  const draftCount = quotes.filter((quote) => quote.status === 'DRAFT').length;
  const sentCount = quotes.filter((quote) => quote.status === 'SENT').length;
  const acceptedCount = quotes.filter((quote) => quote.status === 'ACCEPTED').length;
  const refusedCount = quotes.filter((quote) => quote.status === 'REFUSED').length;

  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [quoteForm, setQuoteForm] = useState(emptyQuoteForm);
  const { success, error, info } = useToast();

  function updateTemplate(field, value) {
    setTemplateForm((current) => ({ ...current, [field]: value }));
  }

  function updateQuote(field, value) {
    setQuoteForm((current) => ({ ...current, [field]: value }));
  }

  async function saveTemplate(e) {
    e.preventDefault();
    const res = await fetch('/api/quote-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(templateForm),
    });
    if (res.ok) {
      setTemplateForm(emptyTemplate);
      mutateTemplates();
      success('Modele de devis cree');
    } else {
      error('Creation impossible', await res.text());
    }
  }

  async function createQuote(e) {
    e.preventDefault();
    const res = await fetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(quoteForm),
    });
    if (res.ok) {
      setQuoteForm(emptyQuoteForm);
      mutate();
      success('Devis genere');
    } else {
      error('Generation impossible', await res.text());
    }
  }

  async function quoteAction(id, action, clientComment) {
    const res = await fetch('/api/quotes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, clientComment }),
    });
    if (res.ok) {
      mutate();
      success('Devis mis a jour');
    } else {
      error('Action impossible', await res.text());
    }
  }

  async function deleteQuote(id) {
    const res = await fetch('/api/quotes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      mutate();
      info('Devis supprime');
    } else {
      error('Suppression impossible', await res.text());
    }
  }

  return (
    <section className="space-y-6">
      <div className="page-section p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="app-stat-badge">Validation commerciale</span>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">Devis & validation</h2>
            <p className="mt-2 text-slate-600">
              Cree des devis propres, envoie-les au bon moment et donne au client une lecture claire avant validation.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <StatCard label="Brouillons" value={draftCount} accent="warm" />
            <StatCard label="Envoyes" value={sentCount} accent="primary" />
            <StatCard label="Acceptes" value={acceptedCount} accent="green" />
            <StatCard label="Refuses" value={refusedCount} accent="pink" />
          </div>
        </div>
      </div>

      {isStaff ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <form onSubmit={saveTemplate} className="surface-card rounded-[1.6rem] p-6 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Modele de devis</h3>
              <p className="mt-1 text-sm text-slate-500">Prepare des cadres reutilisables pour aller plus vite selon le type de prestation.</p>
            </div>
            <input className="app-input w-full rounded-xl px-4 py-3" placeholder="Nom du modele" value={templateForm.name} onChange={(e) => updateTemplate('name', e.target.value)} required />
            <textarea className="app-textarea min-h-[100px] w-full rounded-xl px-4 py-3" rows="2" placeholder="Description" value={templateForm.description} onChange={(e) => updateTemplate('description', e.target.value)} />
            <select className="app-select w-full rounded-xl px-4 py-3" value={templateForm.calculationMode} onChange={(e) => updateTemplate('calculationMode', e.target.value)}>
              <option value="MIXED">Mix</option>
              <option value="PER_GUEST">Par invite</option>
              <option value="PACKAGE">Forfait</option>
            </select>
            <input className="app-input w-full rounded-xl px-4 py-3" type="number" min="0" step="0.01" placeholder="Acompte par defaut" value={templateForm.defaultDeposit} onChange={(e) => updateTemplate('defaultDeposit', e.target.value)} />
            <textarea className="app-textarea min-h-[120px] w-full rounded-xl px-4 py-3" rows="3" placeholder="Conditions" value={templateForm.terms} onChange={(e) => updateTemplate('terms', e.target.value)} />
            <button className="app-button-primary rounded-xl px-5 py-3 font-semibold">Ajouter modele</button>
          </form>

          <form onSubmit={createQuote} className="surface-card rounded-[1.6rem] p-6 space-y-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Generer un devis</h3>
              <p className="mt-1 text-sm text-slate-500">Pars d’un evenement valide et compose un devis facile a comprendre pour le client.</p>
            </div>
            <select className="app-select w-full rounded-xl px-4 py-3" value={quoteForm.eventId} onChange={(e) => updateQuote('eventId', e.target.value)} required>
              <option value="">Evenement</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>{event.name} - {event.owner?.name || event.owner?.email}</option>
              ))}
            </select>
            <select className="app-select w-full rounded-xl px-4 py-3" value={quoteForm.templateId} onChange={(e) => updateQuote('templateId', e.target.value)}>
              <option value="">Sans modele</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            <select className="app-select w-full rounded-xl px-4 py-3" value={quoteForm.calculationMode} onChange={(e) => updateQuote('calculationMode', e.target.value)}>
              <option value="MIXED">Mix</option>
              <option value="PER_GUEST">Par invite</option>
              <option value="PACKAGE">Forfait</option>
            </select>
            <div className="grid gap-3 md:grid-cols-3">
              <input className="app-input rounded-xl px-4 py-3" type="number" min="0" step="0.01" placeholder="Frais de livraison" value={quoteForm.deliveryFee} onChange={(e) => updateQuote('deliveryFee', e.target.value)} />
              <input className="app-input rounded-xl px-4 py-3" type="number" min="0" step="0.01" placeholder="Frais d'installation" value={quoteForm.installationFee} onChange={(e) => updateQuote('installationFee', e.target.value)} />
              <input className="app-input rounded-xl px-4 py-3" type="number" min="0" step="0.01" placeholder="Remise commerciale" value={quoteForm.discount} onChange={(e) => updateQuote('discount', e.target.value)} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="app-input rounded-xl px-4 py-3" type="number" min="0" step="0.01" placeholder="Montant de l'acompte" value={quoteForm.depositAmount} onChange={(e) => updateQuote('depositAmount', e.target.value)} />
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={quoteForm.depositRequired} onChange={(e) => updateQuote('depositRequired', e.target.checked)} />
                Acompte requis
              </label>
            </div>
            <textarea className="app-textarea min-h-[100px] w-full rounded-xl px-4 py-3" rows="2" placeholder="Conditions specifiques" value={quoteForm.terms} onChange={(e) => updateQuote('terms', e.target.value)} />
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={quoteForm.send} onChange={(e) => updateQuote('send', e.target.checked)} />
              Envoyer directement au client
            </label>
            <button className="app-button-primary rounded-xl px-5 py-3 font-semibold">Generer</button>
          </form>
        </div>
      ) : null}

      <div className="space-y-4">
        {quotes.map((quote) => (
          <QuotePreview
            key={quote.id}
            quote={quote}
            isStaff={isStaff}
            onSend={(id) => quoteAction(id, 'send')}
            onDelete={deleteQuote}
            onDecision={quoteAction}
          />
        ))}
        {quotes.length === 0 ? (
          <div className="page-section p-6 text-slate-500">Aucun devis.</div>
        ) : null}
      </div>
    </section>
  );
}
