import useSWR from 'swr';
import { useSession } from 'next-auth/react';
import { useMemo, useState } from 'react';
import { useToast } from './ToastProvider';

const fetcher = (url) => fetch(url).then((r) => r.json());

const emptyProduct = {
  id: null,
  name: '',
  description: '',
  price: '',
  image: '',
  galleryText: '',
  categoryId: '',
  type: 'PRODUCT',
  variantsText: '',
  stock: '',
  isAvailable: true,
  recommendedForText: '',
};

const emptyTemplate = {
  id: null,
  name: '',
  occasionType: '',
  description: '',
  theme: '',
  guestCount: '',
  budget: '',
  suggestedTagsText: '',
  suggestedProductIdsText: '',
  serviceBuffet: false,
  serviceDeco: false,
  serviceOrganisation: false,
  serviceGateaux: false,
  serviceMobilier: false,
  serviceAnimation: false,
  serviceLieu: false,
};

const serviceFields = [
  ['serviceBuffet', 'Buffet'],
  ['serviceDeco', 'Decoration'],
  ['serviceOrganisation', 'Organisation'],
  ['serviceGateaux', 'Gateaux'],
  ['serviceMobilier', 'Mobilier'],
  ['serviceAnimation', 'Animation'],
  ['serviceLieu', 'Lieu'],
];

function listToText(value) {
  return Array.isArray(value) ? value.join(', ') : value || '';
}

function textToList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function productToForm(product) {
  return {
    id: product.id,
    name: product.name || '',
    description: product.description || '',
    price: product.price || '',
    image: product.image || '',
    galleryText: listToText(product.gallery),
    categoryId: product.categoryId || '',
    type: product.type || 'PRODUCT',
    variantsText: listToText(product.variants),
    stock: product.stock ?? '',
    isAvailable: Boolean(product.isAvailable),
    recommendedForText: listToText(product.recommendedFor),
  };
}

function templateToForm(template) {
  return {
    ...emptyTemplate,
    ...template,
    suggestedTagsText: listToText(template.suggestedTags),
    suggestedProductIdsText: listToText(template.suggestedProductIds),
  };
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

function ProductCard({ product, isStaff, onEdit, onDelete, onAddToEvent }) {
  const gallery = product.gallery || [];
  const variants = product.variants || [];

  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white/92 shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg">
      <img
        src={product.image || gallery[0] || 'https://placehold.co/600x400?text=Offre'}
        alt={product.name}
        className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.02]"
      />
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900">{product.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{product.category?.name || 'Sans categorie'}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
            {product.type === 'PACK' ? 'Pack' : 'Produit'}
          </span>
        </div>

        {product.description ? <p className="mt-3 text-sm leading-6 text-slate-600">{product.description}</p> : null}
        <p className="mt-3 text-lg font-semibold text-indigo-700">{product.price}</p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className={`rounded-full px-3 py-1 font-semibold ${product.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {product.isAvailable ? 'Disponible' : 'Indisponible'}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
            Stock: {product.stock ?? 'illimite'}
          </span>
        </div>

        {variants.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.05em] text-slate-400">Options</p>
            <div className="flex flex-wrap gap-2">
              {variants.map((variant) => (
                <span key={variant} className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700">
                  {variant}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {gallery.length > 0 ? (
          <div className="mt-4 grid grid-cols-4 gap-2">
            {gallery.slice(0, 4).map((src) => (
              <img key={src} src={src} alt="" className="h-14 w-full rounded-xl border border-slate-200 object-cover" />
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          {isStaff ? (
            <>
              <button onClick={() => onEdit(product)} className="app-button-secondary flex-1 rounded-xl py-2 font-semibold">
                Modifier
              </button>
              <button onClick={() => onDelete(product.id)} className="flex-1 rounded-xl bg-rose-50 py-2 font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100">
                Supprimer
              </button>
            </>
          ) : (
            <button
              onClick={() => onAddToEvent(product.id)}
              disabled={!product.isAvailable}
              className="app-button-primary w-full rounded-xl py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ajouter a mon evenement
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function StaffCatalogueSection({
  products,
  categories,
  templates,
  productForm,
  categoryName,
  templateForm,
  setCategoryName,
  updateProduct,
  updateTemplate,
  saveCategory,
  deleteCategory,
  saveProduct,
  setProductForm,
  saveTemplate,
  setTemplateForm,
  deleteTemplate,
  onEditProduct,
  onDeleteProduct,
}) {
  return (
    <section className="space-y-6">
      <div className="page-section p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="app-stat-badge">Gestion d'offres</span>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">Catalogue & offres</h2>
            <p className="mt-2 text-slate-600">
              Cree, ajuste et structure facilement les prestations, packs et templates pour que ton equipe aille plus vite.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4 lg:min-w-[520px]">
            <StatCard label="Offres" value={products.length} accent="primary" />
            <StatCard label="Categories" value={categories.length} accent="warm" />
            <StatCard label="Templates" value={templates.length} accent="green" />
            <StatCard label="Disponibles" value={products.filter((item) => item.isAvailable).length} accent="pink" />
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="surface-card rounded-[1.6rem] p-6">
          <h3 className="text-xl font-bold text-slate-900">Categories</h3>
          <p className="mt-1 text-sm text-slate-500">Organise ton catalogue pour le rendre plus simple a vendre.</p>
          <form onSubmit={saveCategory} className="mt-4 flex gap-2">
            <input className="app-input flex-1 rounded-xl px-4 py-3" placeholder="Buffet, deco, mobilier..." value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            <button className="app-button-primary rounded-xl px-4 font-semibold">Ajouter</button>
          </form>
          <div className="mt-4 space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="font-medium text-slate-800">{category.name} ({category._count?.products || 0})</span>
                <button className="text-sm font-semibold text-rose-600" onClick={() => deleteCategory(category.id)}>
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={saveProduct} className="surface-card rounded-[1.6rem] p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-bold text-slate-900">{productForm.id ? 'Modifier une offre' : 'Ajouter une offre'}</h3>
              <p className="mt-1 text-sm text-slate-500">Produit, service ou pack avec galerie, options et recommandations.</p>
            </div>
            {productForm.id ? <span className="app-stat-badge">Edition</span> : null}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <input className="app-input rounded-xl px-4 py-3" placeholder="Nom" value={productForm.name} onChange={(e) => updateProduct('name', e.target.value)} required />
            <input className="app-input rounded-xl px-4 py-3" placeholder="Prix (ex: 150 EUR / Sur devis)" value={productForm.price} onChange={(e) => updateProduct('price', e.target.value)} required />
            <select className="app-select rounded-xl px-4 py-3" value={productForm.categoryId} onChange={(e) => updateProduct('categoryId', e.target.value)}>
              <option value="">Categorie</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <select className="app-select rounded-xl px-4 py-3" value={productForm.type} onChange={(e) => updateProduct('type', e.target.value)}>
              <option value="PRODUCT">Produit / service</option>
              <option value="PACK">Pack</option>
            </select>
            <input className="app-input rounded-xl px-4 py-3" placeholder="Image principale URL" value={productForm.image} onChange={(e) => updateProduct('image', e.target.value)} />
            <input className="app-input rounded-xl px-4 py-3" placeholder="Stock simple" type="number" min="0" value={productForm.stock} onChange={(e) => updateProduct('stock', e.target.value)} />
            <input className="app-input rounded-xl px-4 py-3 md:col-span-2" placeholder="Galerie URLs separees par virgules" value={productForm.galleryText} onChange={(e) => updateProduct('galleryText', e.target.value)} />
            <input className="app-input rounded-xl px-4 py-3 md:col-span-2" placeholder="Options/variantes: rouge, bleu, 10 personnes, XL..." value={productForm.variantsText} onChange={(e) => updateProduct('variantsText', e.target.value)} />
            <input className="app-input rounded-xl px-4 py-3 md:col-span-2" placeholder="Recommande pour: Mariage, Anniversaire, Naissance..." value={productForm.recommendedForText} onChange={(e) => updateProduct('recommendedForText', e.target.value)} />
            <textarea className="app-textarea min-h-[120px] rounded-xl px-4 py-3 md:col-span-2" placeholder="Description" value={productForm.description} onChange={(e) => updateProduct('description', e.target.value)} />
            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 md:col-span-2">
              <input type="checkbox" checked={productForm.isAvailable} onChange={(e) => updateProduct('isAvailable', e.target.checked)} />
              Disponible
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button className="app-button-primary rounded-xl px-5 py-3 font-semibold">
              {productForm.id ? 'Enregistrer' : 'Ajouter'}
            </button>
            {productForm.id ? (
              <button type="button" className="app-button-secondary rounded-xl px-5 py-3 font-semibold" onClick={() => setProductForm(emptyProduct)}>
                Annuler
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <form onSubmit={saveTemplate} className="surface-card rounded-[1.6rem] p-6">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{templateForm.id ? 'Modifier un template' : "Templates d'evenement"}</h3>
            <p className="mt-1 text-sm text-slate-500">Prepare des suggestions automatiques selon le type d'occasion.</p>
          </div>
          {templateForm.id ? <span className="app-stat-badge">Edition</span> : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <input className="app-input rounded-xl px-4 py-3" placeholder="Nom (Naissance Basic)" value={templateForm.name} onChange={(e) => updateTemplate('name', e.target.value)} required />
          <input className="app-input rounded-xl px-4 py-3" placeholder="Type d'evenement" value={templateForm.occasionType} onChange={(e) => updateTemplate('occasionType', e.target.value)} required />
          <input className="app-input rounded-xl px-4 py-3" placeholder="Theme suggere" value={templateForm.theme} onChange={(e) => updateTemplate('theme', e.target.value)} />
          <input className="app-input rounded-xl px-4 py-3" type="number" placeholder="Invites" value={templateForm.guestCount} onChange={(e) => updateTemplate('guestCount', e.target.value)} />
          <input className="app-input rounded-xl px-4 py-3" type="number" placeholder="Budget" value={templateForm.budget} onChange={(e) => updateTemplate('budget', e.target.value)} />
          <input className="app-input rounded-xl px-4 py-3" placeholder="IDs produits suggeres: 1, 2, 3" value={templateForm.suggestedProductIdsText} onChange={(e) => updateTemplate('suggestedProductIdsText', e.target.value)} />
          <input className="app-input rounded-xl px-4 py-3 md:col-span-3" placeholder="Tags suggeres: buffet, deco, pastel..." value={templateForm.suggestedTagsText} onChange={(e) => updateTemplate('suggestedTagsText', e.target.value)} />
          <textarea className="app-textarea min-h-[110px] rounded-xl px-4 py-3 md:col-span-3" placeholder="Description" value={templateForm.description} onChange={(e) => updateTemplate('description', e.target.value)} />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-4 text-sm">
          {serviceFields.map(([field, label]) => (
            <label key={field} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={templateForm[field]} onChange={(e) => updateTemplate(field, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button className="app-button-primary rounded-xl px-5 py-3 font-semibold">
            {templateForm.id ? 'Enregistrer' : 'Ajouter template'}
          </button>
          {templateForm.id ? (
            <button type="button" className="app-button-secondary rounded-xl px-5 py-3 font-semibold" onClick={() => setTemplateForm(emptyTemplate)}>
              Annuler
            </button>
          ) : null}
        </div>
      </form>

      <div className="surface-card overflow-hidden rounded-[1.6rem]">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">Bibliotheque de templates</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-4">Template</th>
                <th className="p-4">Type</th>
                <th className="p-4">Suggestions</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr key={template.id} className="border-t border-slate-200">
                  <td className="p-4 font-semibold text-slate-900">{template.name}</td>
                  <td className="p-4 text-slate-600">{template.occasionType}</td>
                  <td className="p-4 text-slate-600">{template.suggestedTags.join(', ') || '-'}</td>
                  <td className="p-4 text-right space-x-3">
                    <button className="font-semibold text-indigo-700" onClick={() => setTemplateForm(templateToForm(template))}>Modifier</button>
                    <button className="font-semibold text-rose-600" onClick={() => deleteTemplate(template.id)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Mes offres</h3>
            <p className="mt-1 text-sm text-slate-500">
              Retrouve toutes les prestations de ton catalogue pour les modifier rapidement.
            </p>
          </div>
          <span className="app-stat-badge">{products.length} offre(s)</span>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              isStaff
              onEdit={onEditProduct}
              onDelete={onDeleteProduct}
            />
          ))}
        </div>

        {products.length === 0 ? (
          <div className="rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Aucune offre pour le moment. Ajoute ton premier produit ou pack ci-dessus.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ClientCatalogueSection({
  clientEvents,
  selectedEventId,
  setSelectedEventId,
  selectedEvent,
  selectedTemplate,
  categories,
  filterCategoryId,
  setFilterCategoryId,
  filterType,
  setFilterType,
  recommendedProducts,
  filteredProducts,
  addToEvent,
}) {
  return (
    <section className="space-y-6">
      <div className="page-section p-6 md:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="app-stat-badge">Selection de prestations</span>
            <h2 className="mt-4 text-3xl font-bold text-slate-900">Catalogue & offres</h2>
            <p className="mt-2 text-slate-600">
              Choisis ton evenement, regarde les recommandations adaptees, puis ajoute facilement les prestations a ta reservation.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
            <StatCard label="Evenements" value={clientEvents.length} accent="primary" />
            <StatCard label="Recommandes" value={recommendedProducts.length} accent="green" />
            <StatCard label="Offres visibles" value={filteredProducts.length} accent="warm" />
          </div>
        </div>
      </div>

      <div className="surface-card rounded-[1.6rem] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Choisir l'evenement</h3>
            <p className="mt-1 text-sm text-slate-500">
              Le catalogue se met au bon organisateur et te pousse les bonnes suggestions.
            </p>
          </div>
          <div className="w-full lg:w-[460px]">
            <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)} className="app-select w-full rounded-2xl px-4 py-3">
              <option value="">Selectionner un evenement</option>
              {clientEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} - {new Date(event.date).toLocaleDateString('fr-FR')} - {event.occasionType || 'Sans type'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedTemplate ? (
          <div className="mt-5 rounded-[1.2rem] border border-indigo-100 bg-gradient-to-r from-indigo-50 via-violet-50 to-white p-4">
            <p className="text-sm font-semibold text-indigo-900">Template suggere: {selectedTemplate.name}</p>
            <p className="mt-1 text-sm text-indigo-800">
              {selectedTemplate.description || 'Suggestions automatiques basees sur le type evenement.'}
            </p>
            {selectedTemplate.suggestedTags.length > 0 ? (
              <p className="mt-2 text-sm text-indigo-800">Tags: {selectedTemplate.suggestedTags.join(', ')}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="surface-card rounded-[1.6rem] p-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <select className="app-select rounded-xl px-4 py-3" value={filterCategoryId} onChange={(e) => setFilterCategoryId(e.target.value)}>
            <option value="">Toutes categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <select className="app-select rounded-xl px-4 py-3" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Produits et packs</option>
            <option value="PRODUCT">Produits/services</option>
            <option value="PACK">Packs</option>
          </select>
        </div>
      </div>

      {recommendedProducts.length > 0 ? (
        <div className="space-y-4">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Recommandes pour {selectedEvent?.occasionType}</h3>
            <p className="mt-1 text-sm text-slate-500">Une selection intelligente pour accelerer la reservation.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {recommendedProducts.map((product) => (
              <ProductCard key={product.id} product={product} isStaff={false} onAddToEvent={addToEvent} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Toutes les offres</h3>
          <p className="mt-1 text-sm text-slate-500">Parcours libre pour completer l'evenement a ton rythme.</p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} isStaff={false} onAddToEvent={addToEvent} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Catalogue() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const isStaff = ['PLATFORM_ADMIN', 'ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(role);
  const { success, error, info } = useToast();

  const { data: eventsData } = useSWR(session && !isStaff ? '/api/events' : null, fetcher);
  const clientEvents = useMemo(() => {
    if (isStaff) return [];
    return (eventsData?.events || []).filter((ev) =>
      ['DRAFT', 'PENDING_APPROVAL', 'ACCEPTED', 'PLANNED'].includes(ev.status)
    );
  }, [eventsData, isStaff]);

  const [selectedEventId, setSelectedEventId] = useState('');
  const selectedEvent = clientEvents.find((event) => String(event.id) === String(selectedEventId));

  const productsUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (!isStaff && selectedEvent?.organizerId) {
      params.set('organizerId', String(selectedEvent.organizerId));
    }
    return `/api/products${params.toString() ? `?${params.toString()}` : ''}`;
  }, [isStaff, selectedEvent?.organizerId]);

  const { data, mutate } = useSWR(productsUrl, fetcher);
  const { data: categoriesData, mutate: mutateCategories } = useSWR('/api/categories', fetcher);
  const { data: templatesData, mutate: mutateTemplates } = useSWR('/api/event-templates', fetcher);

  const products = data?.products || [];
  const categories = categoriesData?.categories || [];
  const templates = templatesData?.templates || [];

  const [productForm, setProductForm] = useState(emptyProduct);
  const [categoryName, setCategoryName] = useState('');
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterType, setFilterType] = useState('');

  const selectedTemplate = selectedEvent
    ? templates.find((template) => template.occasionType === selectedEvent.occasionType)
    : null;

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (filterCategoryId && String(product.categoryId) !== String(filterCategoryId)) return false;
      if (filterType && product.type !== filterType) return false;
      return true;
    });
  }, [products, filterCategoryId, filterType]);

  const recommendedProducts = useMemo(() => {
    if (!selectedEvent) return [];
    const fromType = products.filter((product) => (product.recommendedFor || []).includes(selectedEvent.occasionType));
    const fromTemplate = selectedTemplate
      ? products.filter((product) => selectedTemplate.suggestedProductIds.includes(product.id))
      : [];
    const byId = new Map([...fromType, ...fromTemplate].map((product) => [product.id, product]));
    return Array.from(byId.values());
  }, [products, selectedEvent, selectedTemplate]);

  function updateProduct(field, value) {
    setProductForm((current) => ({ ...current, [field]: value }));
  }

  function updateTemplate(field, value) {
    setTemplateForm((current) => ({ ...current, [field]: value }));
  }

  async function saveCategory(e) {
    e.preventDefault();

    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: categoryName }),
    });

    if (res.ok) {
      setCategoryName('');
      mutateCategories();
      success('Categorie ajoutee', 'La nouvelle categorie est disponible dans le catalogue.');
    } else {
      error('Creation impossible', await res.text());
    }
  }

  async function deleteCategory(id) {
    const res = await fetch('/api/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      success('Categorie supprimee');
      mutateCategories();
    } else {
      error('Suppression impossible', await res.text());
    }
  }

  async function saveProduct(e) {
    e.preventDefault();

    const payload = {
      id: productForm.id,
      name: productForm.name,
      description: productForm.description,
      price: productForm.price,
      image: productForm.image,
      gallery: textToList(productForm.galleryText),
      categoryId: productForm.categoryId,
      type: productForm.type,
      variants: textToList(productForm.variantsText),
      stock: productForm.stock,
      isAvailable: productForm.isAvailable,
      recommendedFor: textToList(productForm.recommendedForText),
    };

    const res = await fetch('/api/products', {
      method: productForm.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setProductForm(emptyProduct);
      mutate();
      success(productForm.id ? 'Offre mise a jour' : 'Offre ajoutee');
    } else {
      error('Enregistrement impossible', await res.text());
    }
  }

  async function deleteProduct(id) {
    const res = await fetch('/api/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });

    if (res.ok) {
      mutate();
      info('Offre supprimee ou archivee');
    } else {
      error('Suppression impossible', await res.text());
    }
  }

  async function saveTemplate(e) {
    e.preventDefault();

    const payload = {
      ...templateForm,
      suggestedTags: textToList(templateForm.suggestedTagsText),
      suggestedProductIds: textToList(templateForm.suggestedProductIdsText),
    };

    const res = await fetch('/api/event-templates', {
      method: templateForm.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      setTemplateForm(emptyTemplate);
      mutateTemplates();
      success(templateForm.id ? 'Template mis a jour' : 'Template ajoute');
    } else {
      error('Template impossible', await res.text());
    }
  }

  async function deleteTemplate(id) {
    const res = await fetch('/api/event-templates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      info('Template supprime');
      mutateTemplates();
    } else {
      error('Suppression impossible', await res.text());
    }
  }

  async function addToEvent(productId) {
    if (!selectedEventId) {
      info('Choisis un evenement', "Selectionne d'abord l'evenement a enrichir.");
      return;
    }

    const res = await fetch(`/api/events/${selectedEventId}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity: 1 }),
    });

    if (!res.ok) {
      error('Ajout impossible', await res.text());
      return;
    }

    success('Offre ajoutee', "L'offre a ete ajoutee a l'evenement.");
  }

  if (isStaff) {
    return (
      <StaffCatalogueSection
        products={products}
        categories={categories}
        templates={templates}
        productForm={productForm}
        categoryName={categoryName}
        templateForm={templateForm}
        setCategoryName={setCategoryName}
        updateProduct={updateProduct}
        updateTemplate={updateTemplate}
        saveCategory={saveCategory}
        deleteCategory={deleteCategory}
        saveProduct={saveProduct}
        setProductForm={setProductForm}
        saveTemplate={saveTemplate}
        setTemplateForm={setTemplateForm}
        deleteTemplate={deleteTemplate}
        onEditProduct={(item) => setProductForm(productToForm(item))}
        onDeleteProduct={deleteProduct}
      />
    );
  }

  return (
    <ClientCatalogueSection
      clientEvents={clientEvents}
      selectedEventId={selectedEventId}
      setSelectedEventId={setSelectedEventId}
      selectedEvent={selectedEvent}
      selectedTemplate={selectedTemplate}
      categories={categories}
      filterCategoryId={filterCategoryId}
      setFilterCategoryId={setFilterCategoryId}
      filterType={filterType}
      setFilterType={setFilterType}
      recommendedProducts={recommendedProducts}
      filteredProducts={filteredProducts}
      addToEvent={addToEvent}
    />
  );
}
