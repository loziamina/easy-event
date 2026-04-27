import { useMemo, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url) => fetch(url).then((res) => res.json());

function MediaGrid({ items, label }) {
  if (!items?.length) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-700">{label}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((url, index) => (
          <div key={`${label}-${index}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            {label === 'Videos' ? (
              <video src={url} controls className="h-56 w-full object-cover bg-black" />
            ) : (
              <img src={url} alt={`${label} ${index + 1}`} className="h-56 w-full object-cover" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatRating(value) {
  if (!value) return 'Nouveau';
  return `${Number(value).toFixed(1)} / 5`;
}

function Stars({ value }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <div className="flex items-center gap-1 text-amber-500">
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rounded ? 'opacity-100' : 'opacity-25'}>
          ★
        </span>
      ))}
    </div>
  );
}

export default function OrganizerDirectory({ onSelectOrganizer }) {
  const [search, setSearch] = useState('');
  const [selectedOrganizer, setSelectedOrganizer] = useState(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    return `/api/organizers${params.toString() ? `?${params.toString()}` : ''}`;
  }, [search]);

  const { data, isLoading } = useSWR(query, fetcher);
  const organizers = data?.organizers || [];

  return (
    <section className="space-y-6">
      <div className="page-section p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="app-stat-badge">Marketplace locale</span>
            <h2 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl">Organisateurs pres de toi</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
              Consulte leur presentation, leurs prestations et reserve avec celui qui te correspond.
            </p>
          </div>
          <div className="w-full md:w-[320px]">
            <label className="text-sm font-semibold text-slate-700">Ville ou zone</label>
            <input
              className="app-input mt-1 w-full rounded-2xl px-4 py-3"
              placeholder="Paris, Lyon, Ile-de-France..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading && <div className="text-slate-500">Chargement des organisateurs...</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {organizers.map((organizer) => (
          <button
            key={organizer.id}
            type="button"
            onClick={() => setSelectedOrganizer(organizer)}
            className="group overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white/92 p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg"
          >
            {organizer.coverImage ? (
              <div className="mb-4 overflow-hidden rounded-[1.4rem] border border-slate-200">
                <img src={organizer.coverImage} alt={organizer.name} className="h-56 w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{organizer.name}</h3>
                <p className="text-sm text-slate-500">
                  {organizer.city || 'Ville non renseignee'}
                  {organizer.serviceArea ? ` - ${organizer.serviceArea}` : ''}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Stars value={organizer.reviewSummary?.averageRating} />
                  <span className="text-sm font-medium text-slate-700">{formatRating(organizer.reviewSummary?.averageRating)}</span>
                  <span className="text-sm text-slate-500">({organizer.reviewSummary?.totalReviews || 0} avis)</span>
                </div>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {organizer.status === 'APPROVED' ? 'Valide' : organizer.status}
              </span>
            </div>

            {organizer.description && (
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{organizer.description}</p>
            )}

            <dl className="mt-5 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-slate-500">Adresse</dt>
                <dd className="font-medium text-slate-800">{organizer.address || 'Non renseignee'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Contact principal</dt>
                <dd className="font-medium text-slate-800">{organizer.owner?.name || organizer.owner?.email || 'A venir'}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Offres publiees</dt>
                <dd className="font-medium text-slate-800">{organizer.counts?.products || 0}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Equipe</dt>
                <dd className="font-medium text-slate-800">{organizer.counts?.users || 0}</dd>
              </div>
            </dl>

            <div className="mt-5 rounded-[1.2rem] border border-indigo-100 bg-gradient-to-r from-indigo-50 via-violet-50 to-white p-4">
              <p className="text-sm font-semibold text-indigo-900">Voir la prestation et reserver</p>
              <p className="mt-1 text-sm text-indigo-800">
                Ouvre la fiche de <span className="font-semibold">{organizer.name}</span> pour consulter ses realisations.
              </p>
            </div>
          </button>
        ))}
      </div>

      {!isLoading && organizers.length === 0 && (
        <div className="page-section p-8 text-center text-slate-500">
          Aucun organisateur trouve pour cette recherche.
        </div>
      )}

      {selectedOrganizer && (
        <div className="fixed inset-0 z-[9998] bg-slate-950/45 backdrop-blur-sm p-4 md:p-8 overflow-y-auto">
          <div className="max-w-5xl mx-auto overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-2xl">
            {selectedOrganizer.coverImage ? (
              <div className="relative h-72 md:h-96">
                <img src={selectedOrganizer.coverImage} alt={selectedOrganizer.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-3xl font-bold">{selectedOrganizer.name}</h3>
                  <p className="text-sm text-white/85 mt-2">
                    {selectedOrganizer.city || 'Ville non renseignee'}
                    {selectedOrganizer.serviceArea ? ` - ${selectedOrganizer.serviceArea}` : ''}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="p-6 md:p-8 space-y-8">
              {!selectedOrganizer.coverImage && (
                <div>
                  <h3 className="text-3xl font-bold">{selectedOrganizer.name}</h3>
                  <p className="text-sm text-slate-500 mt-2">
                    {selectedOrganizer.city || 'Ville non renseignee'}
                    {selectedOrganizer.serviceArea ? ` - ${selectedOrganizer.serviceArea}` : ''}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-8">
                <div className="space-y-6">
                  <div>
                    <span className="app-stat-badge">Fiche organisateur</span>
                    <h4 className="mt-4 text-lg font-bold text-slate-900">Presentation</h4>
                    <p className="text-slate-600 mt-2 whitespace-pre-wrap">{selectedOrganizer.description || 'Presentation a venir.'}</p>
                  </div>

                  <MediaGrid items={selectedOrganizer.portfolioImages} label="Photos" />
                  <MediaGrid items={selectedOrganizer.portfolioVideos} label="Videos" />

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-lg font-bold text-slate-900">Avis clients</h4>
                      <span className="text-sm text-slate-500">{selectedOrganizer.reviewSummary?.totalReviews || 0} avis</span>
                    </div>

                    <div className="mt-4 space-y-4">
                      {(selectedOrganizer.reviews || []).map((review) => (
                        <article key={review.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{review.author?.name || 'Client'}</p>
                              <p className="text-xs text-slate-500">
                                {review.event?.name || 'Evenement'}
                                {review.event?.date ? ` - ${new Date(review.event.date).toLocaleDateString('fr-FR')}` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <Stars value={review.organizerRating} />
                              <p className="text-xs text-slate-500 mt-1">{new Date(review.createdAt).toLocaleDateString('fr-FR')}</p>
                            </div>
                          </div>

                          {review.organizerComment ? (
                            <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap">{review.organizerComment}</p>
                          ) : null}

                          {review.reviewedStaff && (review.staffRating || review.staffComment) ? (
                            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-900">Avis staff : {review.reviewedStaff.name}</p>
                                {review.staffRating ? <Stars value={review.staffRating} /> : null}
                              </div>
                              {review.staffComment ? (
                                <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">{review.staffComment}</p>
                              ) : null}
                            </div>
                          ) : null}
                        </article>
                      ))}

                      {(selectedOrganizer.reviews || []).length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                          Aucun avis pour le moment.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="surface-card rounded-[1.5rem] p-5">
                    <h4 className="text-lg font-bold text-slate-900">Informations</h4>
                    <dl className="space-y-3 mt-4 text-sm">
                      <div>
                        <dt className="text-slate-500">Adresse</dt>
                        <dd className="font-medium text-slate-800">{selectedOrganizer.address || 'Non renseignee'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Contact principal</dt>
                        <dd className="font-medium text-slate-800">{selectedOrganizer.owner?.name || selectedOrganizer.owner?.email || 'A venir'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Telephone</dt>
                        <dd className="font-medium text-slate-800">{selectedOrganizer.owner?.phone || 'Non renseigne'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Note moyenne</dt>
                        <dd className="mt-1 flex flex-wrap items-center gap-2 font-medium text-slate-800">
                          <Stars value={selectedOrganizer.reviewSummary?.averageRating} />
                          <span>{formatRating(selectedOrganizer.reviewSummary?.averageRating)}</span>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Offres publiees</dt>
                        <dd className="font-medium text-slate-800">{selectedOrganizer.counts?.products || 0}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Equipe</dt>
                        <dd className="font-medium text-slate-800">{selectedOrganizer.counts?.users || 0}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="surface-card rounded-[1.5rem] p-5">
                    <p className="text-sm font-semibold text-slate-900">Pret a reserver ?</p>
                    <p className="text-sm text-slate-600 mt-2">
                      Le formulaire d evenement sera pre-rempli avec <span className="font-semibold">{selectedOrganizer.name}</span>.
                    </p>
                    <div className="mt-4 flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectOrganizer?.(selectedOrganizer);
                          setSelectedOrganizer(null);
                        }}
                        className="app-button-primary w-full rounded-2xl px-4 py-3 font-semibold"
                      >
                        Reserver avec cet organisateur
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedOrganizer(null)}
                        className="app-button-secondary w-full rounded-2xl px-4 py-3 font-semibold"
                      >
                        Fermer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
