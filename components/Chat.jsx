import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useToast } from './ToastProvider';

const fetcher = (url) => fetch(url).then((r) => r.json());

function linkLabel(message) {
  if (message.linkType === 'QUOTE') return `Devis #${message.linkId}`;
  if (message.linkType === 'MOCKUP') return `Maquette #${message.linkId}`;
  return null;
}

function modeLabel(mode) {
  return mode === 'team' ? 'Equipe' : 'Clients';
}

export default function Chat({ clientId }) {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { error, success, info } = useToast();
  const isPlatformAdmin = role === 'PLATFORM_ADMIN';
  const isOrganizerUser = ['ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(role);
  const isClient = role === 'CLIENT';

  const [mode, setMode] = useState(isOrganizerUser ? 'clients' : isPlatformAdmin ? 'support' : 'client');
  const [selectedClientId, setSelectedClientId] = useState(clientId || '');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('unread');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedMode = window.localStorage.getItem('selectedChatMode');
    const storedClientId = window.localStorage.getItem('selectedChatClientId');

    if (isPlatformAdmin) {
      setMode('support');
    } else if (isOrganizerUser && storedMode && ['clients', 'team'].includes(storedMode)) {
      setMode(storedMode);
    }

    if (storedClientId) {
      setSelectedClientId(storedClientId);
    }
  }, [isPlatformAdmin, isOrganizerUser]);

  const activeMode = isPlatformAdmin ? 'support' : mode;
  const query = useMemo(() => {
    if (activeMode === 'team') return '/api/team-conversations?markRead=false';
    if (activeMode === 'support') return '/api/conversations?markRead=false';
    if (isClient) return '/api/conversations';
    return '/api/conversations?markRead=false';
  }, [activeMode, isClient]);

  const { data, mutate, isLoading } = useSWR(query, fetcher, { refreshInterval: 5000 });
  const { data: templatesData } = useSWR(activeMode === 'clients' && isOrganizerUser ? '/api/chat-templates' : null, fetcher);
  const { data: quotesData } = useSWR(activeMode === 'clients' && isOrganizerUser ? '/api/quotes' : null, fetcher);
  const { data: mockupsData } = useSWR(activeMode === 'clients' && isOrganizerUser ? '/api/mockups' : null, fetcher);

  const convs = data?.convs || [];
  const filteredConvs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const filtered = convs.filter((item) => {
      const haystack = [
        item.contactName,
        item.contactEmail,
        item.organizer?.name,
        item.event?.name,
        item.messages?.[item.messages.length - 1]?.text,
      ].filter(Boolean);

      const matchesSearch = !normalizedSearch || haystack.some((value) => String(value).toLowerCase().includes(normalizedSearch));
      const matchesStatus = activeMode !== 'clients' || !statusFilter || item.event?.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    return filtered.sort((a, b) => {
      if (sortBy === 'unread') {
        if ((b.unreadCount || 0) !== (a.unreadCount || 0)) return (b.unreadCount || 0) - (a.unreadCount || 0);
        return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
      }
      if (sortBy === 'eventDate') {
        return new Date(a.event?.date || 0) - new Date(b.event?.date || 0);
      }
      return new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0);
    });
  }, [convs, search, statusFilter, sortBy, activeMode]);

  const conv = useMemo(() => {
    if (isClient) return convs[0];
    return filteredConvs.find((item) => String(item.clientId) === String(selectedClientId)) || filteredConvs[0] || convs[0];
  }, [convs, filteredConvs, selectedClientId, isClient]);

  const activeClientId = clientId || conv?.clientId || selectedClientId;
  const templates = templatesData?.templates || [];
  const quotes = (quotesData?.quotes || []).filter((quote) => !activeClientId || quote.event?.owner?.id === Number(activeClientId));
  const mockups = (mockupsData?.mockups || []).filter((mockup) => !activeClientId || mockup.event?.ownerId === Number(activeClientId));

  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState({ url: '', name: '', type: '' });
  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');

  useEffect(() => {
    if (!selectedClientId && filteredConvs[0]?.clientId) {
      setSelectedClientId(filteredConvs[0].clientId);
    }
  }, [filteredConvs, selectedClientId]);

  async function selectConversation(nextClientId, conversationId) {
    setSelectedClientId(nextClientId);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('selectedChatClientId', String(nextClientId));
      window.localStorage.setItem('selectedChatMode', activeMode);
    }

    const numericId = Number(conversationId);
    if (!numericId) return;

    const endpoint = activeMode === 'team' ? '/api/team-conversations' : '/api/conversations';
    await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: numericId }),
    });
    await mutate();
  }

  async function send(payload = {}) {
    const finalText = payload.text ?? text;
    if (!String(finalText).trim()) return;

    const endpoint = activeMode === 'team' ? '/api/team-conversations' : '/api/conversations';
    const body = activeMode === 'team'
      ? {
          text: finalText,
          targetUserId: activeClientId,
          attachmentUrl: payload.attachmentUrl ?? attachment.url,
          attachmentName: payload.attachmentName ?? attachment.name,
          attachmentType: payload.attachmentType ?? attachment.type,
        }
      : {
          text: finalText,
          clientId: !isClient ? activeClientId : undefined,
          attachmentUrl: payload.attachmentUrl ?? attachment.url,
          attachmentName: payload.attachmentName ?? attachment.name,
          attachmentType: payload.attachmentType ?? attachment.type,
          linkType: payload.linkType,
          linkId: payload.linkId,
        };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      error('Envoi impossible', err.message || 'Le message n a pas pu etre envoye.');
      return;
    }

    setText('');
    setAttachment({ url: '', name: '', type: '' });
    success('Message envoye', 'La conversation a ete mise a jour.');
    await mutate();
  }

  async function createTemplate(e) {
    e.preventDefault();
    if (!quickTitle.trim() || !quickBody.trim()) return;
    const res = await fetch('/api/chat-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: quickTitle, body: quickBody }),
    });
    if (res.ok) {
      setQuickTitle('');
      setQuickBody('');
      info('Template ajoute', 'Le message rapide est disponible.');
    }
  }

  async function shareQuote(quote) {
    await send({
      text: `Votre devis ${quote.number} est disponible dans l onglet Devis. Total: ${Number(quote.total || 0).toLocaleString('fr-FR')} EUR`,
      linkType: 'QUOTE',
      linkId: quote.id,
    });
  }

  async function shareMockup(mockup) {
    await send({
      text: `Une maquette est disponible: ${mockup.title} v${mockup.version}. Vous pouvez la consulter dans l onglet Maquettes.`,
      linkType: 'MOCKUP',
      linkId: mockup.id,
      attachmentUrl: mockup.url,
      attachmentName: mockup.title,
      attachmentType: mockup.fileType,
    });
  }

  return (
    <div className="flex h-full bg-white">
      {!isClient && (
        <aside className="w-80 border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-4 border-b border-slate-200 space-y-3">
            <div>
              <h3 className="font-bold">
                {isPlatformAdmin ? 'Support organisateurs' : isOrganizerUser ? 'Communication' : 'Messages'}
              </h3>
              <p className="text-xs text-slate-500">
                {isPlatformAdmin
                  ? 'Admin communique uniquement avec les organisateurs.'
                  : isOrganizerUser
                    ? 'Clients et equipe interne.'
                    : 'Messages'}
              </p>
            </div>

            {isOrganizerUser && (
              <div className="grid grid-cols-2 gap-2">
                {['clients', 'team'].map((value) => (
                  <button
                    key={value}
                    onClick={() => {
                      setMode(value);
                      setSelectedClientId('');
                      if (typeof window !== 'undefined') {
                        window.localStorage.setItem('selectedChatMode', value);
                      }
                    }}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${activeMode === value ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {modeLabel(value)}
                  </button>
                ))}
              </div>
            )}

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isPlatformAdmin
                  ? 'Rechercher organisateur, email, message...'
                  : activeMode === 'team'
                    ? 'Rechercher membre equipe...'
                    : 'Rechercher client, evenement, message...'
              }
              className="w-full p-2 border border-slate-200 rounded-lg text-sm"
            />

            {activeMode === 'clients' && isOrganizerUser && (
              <div className="grid grid-cols-2 gap-2">
                <select className="p-2 border border-slate-200 rounded-lg text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Tous statuts</option>
                  <option value="PENDING_APPROVAL">En attente</option>
                  <option value="ACCEPTED">Accepte</option>
                  <option value="PLANNED">Planifie</option>
                  <option value="DONE">Termine</option>
                </select>
                <select className="p-2 border border-slate-200 rounded-lg text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="unread">Non lus</option>
                  <option value="latest">Dernier msg</option>
                  <option value="eventDate">Date event</option>
                </select>
              </div>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {filteredConvs.map((item) => {
              const lastMessage = item.messages?.[item.messages.length - 1];
              return (
                <button
                  key={`${activeMode}-${item.id}`}
                  onClick={() => selectConversation(item.clientId, item.id)}
                  className={`w-full text-left p-4 hover:bg-slate-50 ${String(conv?.clientId) === String(item.clientId) ? 'bg-violet-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{item.contactName}</p>
                      {item.contactEmail ? <p className="text-xs text-slate-500 truncate">{item.contactEmail}</p> : null}
                    </div>
                    {item.unreadCount > 0 && (
                      <span className="min-w-[24px] px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs text-center">
                        {item.unreadCount}
                      </span>
                    )}
                  </div>

                  <p className="mt-2 text-sm text-slate-700">
                    {activeMode === 'clients'
                      ? item.event?.name || 'Aucun evenement actif'
                      : item.organizer?.name || item.contactName}
                  </p>

                  {activeMode === 'clients' && item.event?.date ? (
                    <p className="text-xs text-slate-500">{new Date(item.event.date).toLocaleDateString('fr-FR')}</p>
                  ) : item.organizer?.status ? (
                    <p className="text-xs text-slate-500">{item.organizer.status}</p>
                  ) : null}

                  {lastMessage?.text ? (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{lastMessage.text}</p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">Aucun message pour le moment.</p>
                  )}

                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.messageCount} message(s)</span>
                    {item.lastMessageAt ? <span>{new Date(item.lastMessageAt).toLocaleDateString('fr-FR')}</span> : null}
                  </div>
                </button>
              );
            })}

            {filteredConvs.length === 0 && <p className="p-4 text-sm text-slate-500">Aucune conversation trouvee.</p>}
          </div>
        </aside>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <div className="p-4 border-b border-slate-200">
          <h3 className="font-bold">{conv?.contactName || 'Selectionne une conversation'}</h3>
          <p className="text-xs text-slate-500">
            {isPlatformAdmin
              ? [conv?.contactEmail, conv?.organizer?.status].filter(Boolean).join(' · ') || 'Support organisateurs'
              : activeMode === 'clients' && conv?.event
                ? `${conv.event.name} · ${new Date(conv.event.date).toLocaleDateString('fr-FR')}`
                : activeMode === 'team'
                  ? 'Communication interne de l equipe'
                  : conv?.organizer?.name || 'Conversation'}
          </p>
          {activeMode === 'clients' && conv?.event?.statusText ? (
            <p className="text-xs text-slate-500">Statut evenement: {conv.event.statusText}</p>
          ) : null}
        </div>

        {activeMode === 'clients' && isOrganizerUser && (
          <div className="p-3 border-b border-slate-200 bg-slate-50 space-y-3">
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setText(template.body)}
                  className="px-3 py-1 text-xs rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-violet-50"
                >
                  {template.title}
                </button>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-2">
              <select className="p-2 border border-slate-200 rounded-lg text-sm" onChange={(e) => {
                const quote = quotes.find((item) => String(item.id) === e.target.value);
                if (quote) shareQuote(quote);
                e.target.value = '';
              }}>
                <option value="">Envoyer un devis</option>
                {quotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>{quote.number} - {quote.status}</option>
                ))}
              </select>
              <select className="p-2 border border-slate-200 rounded-lg text-sm" onChange={(e) => {
                const mockup = mockups.find((item) => String(item.id) === e.target.value);
                if (mockup) shareMockup(mockup);
                e.target.value = '';
              }}>
                <option value="">Envoyer une maquette</option>
                {mockups.map((mockup) => (
                  <option key={mockup.id} value={mockup.id}>{mockup.title} v{mockup.version}</option>
                ))}
              </select>
            </div>

            <form onSubmit={createTemplate} className="grid md:grid-cols-[160px_1fr_auto] gap-2">
              <input className="p-2 border border-slate-200 rounded-lg text-sm" placeholder="Titre template" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} />
              <input className="p-2 border border-slate-200 rounded-lg text-sm" placeholder="Message rapide" value={quickBody} onChange={(e) => setQuickBody(e.target.value)} />
              <button className="px-3 py-2 bg-slate-900 text-white rounded-lg text-sm">Creer</button>
            </form>
          </div>
        )}

        <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-50">
          {isLoading ? <p className="text-slate-500">Chargement...</p> : null}
          {!conv ? <p className="text-slate-500">Aucun message. Ecris le premier.</p> : null}

          {conv?.messages?.map((message) => {
            const mine = isPlatformAdmin
              ? message.sender === 'PLATFORM_ADMIN'
              : activeMode === 'clients'
                ? (isClient ? message.sender === 'CLIENT' : message.sender !== 'CLIENT')
                : message.authorId === Number(session?.user?.id);
            const richLabel = linkLabel(message);

            return (
              <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`p-3 rounded-2xl max-w-[80%] ${mine ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200'}`}>
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                  {richLabel ? (
                    <p className={`mt-2 text-xs font-semibold ${mine ? 'text-violet-100' : 'text-violet-700'}`}>
                      {richLabel}
                    </p>
                  ) : null}
                  {message.attachmentUrl ? (
                    <a
                      href={message.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`mt-2 block text-xs underline ${mine ? 'text-violet-100' : 'text-violet-700'}`}
                    >
                      {message.attachmentName || 'Piece jointe'}
                    </a>
                  ) : null}
                  <div className="text-xs mt-1 opacity-70 text-right">
                    {message.timestamp}
                    {mine ? <span> · {message.readAt ? 'lu' : 'non lu'}</span> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-200 bg-white space-y-3">
          <div className="grid md:grid-cols-3 gap-2">
            <input
              value={attachment.url}
              onChange={(e) => setAttachment({ ...attachment, url: e.target.value })}
              placeholder="URL piece jointe"
              className="p-2 border border-slate-200 rounded-lg text-sm"
            />
            <input
              value={attachment.name}
              onChange={(e) => setAttachment({ ...attachment, name: e.target.value })}
              placeholder="Nom piece jointe"
              className="p-2 border border-slate-200 rounded-lg text-sm"
            />
            <input
              value={attachment.type}
              onChange={(e) => setAttachment({ ...attachment, type: e.target.value })}
              placeholder="Type: image, pdf..."
              className="p-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={activeMode === 'team' ? 'Ecrire a un membre de l equipe...' : 'Ecrire un message...'}
              className="w-full p-3 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!text.trim() || (!isClient && !activeClientId)}
              className="bg-violet-600 text-white px-4 py-3 rounded-full hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
