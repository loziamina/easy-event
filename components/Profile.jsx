import { useEffect, useMemo, useState } from 'react';
import { useToast } from './ToastProvider';

function toList(items) {
  return Array.isArray(items) ? items : [];
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadFile(file, category) {
  const dataUrl = await fileToDataUrl(file);
  const res = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataUrl,
      category,
      filename: file.name,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.message || 'Upload impossible');
  }
  return payload.url;
}

function MediaPreview({ items, type, onRemove }) {
  if (!items.length) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((url, index) => (
        <div key={`${type}-${index}`} className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
          {type === 'video' ? (
            <video src={url} controls className="h-56 w-full object-cover bg-black" />
          ) : (
            <img src={url} alt={`media-${index + 1}`} className="h-56 w-full object-cover" />
          )}
          <div className="p-3 flex justify-end">
            <button type="button" onClick={() => onRemove(index)} className="text-sm font-semibold text-rose-600 hover:text-rose-700">
              Supprimer
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    email: '',
    role: '',
    avatarUrl: '',
    organizerName: '',
    organizerCity: '',
    organizerAddress: '',
    organizerServiceArea: '',
    organizerDescription: '',
    organizerCoverImage: '',
    organizerStatus: '',
  });
  const [portfolioImages, setPortfolioImages] = useState([]);
  const [portfolioVideos, setPortfolioVideos] = useState([]);
  const [isOrganizerUser, setIsOrganizerUser] = useState(false);
  const [uploading, setUploading] = useState({ avatar: false, cover: false, image: false, video: false });
  const { success, error, info } = useToast();

  useEffect(() => {
    fetch('/api/account/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          const organizer = data.user.organizer || null;
          setIsOrganizerUser(['ORGANIZER_OWNER', 'ORGANIZER_STAFF'].includes(data.user.role));
          setForm({
            name: data.user.name || '',
            phone: data.user.phone || '',
            address: data.user.address || '',
            email: data.user.email || '',
            role: data.user.role || '',
            avatarUrl: data.user.avatarUrl || '',
            organizerName: organizer?.name || '',
            organizerCity: organizer?.city || '',
            organizerAddress: organizer?.address || '',
            organizerServiceArea: organizer?.serviceArea || '',
            organizerDescription: organizer?.description || '',
            organizerCoverImage: organizer?.coverImage || '',
            organizerStatus: organizer?.status || '',
          });
          setPortfolioImages(toList(organizer?.portfolioImages));
          setPortfolioVideos(toList(organizer?.portfolioVideos));
        }
      });
  }, []);

  const canSave = useMemo(() => !Object.values(uploading).some(Boolean), [uploading]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleUpload(event, category) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading((current) => ({ ...current, [category]: true }));
      const url = await uploadFile(file, category === 'avatar' ? 'avatar' : category === 'cover' ? 'cover' : category === 'image' ? 'portfolio-image' : 'portfolio-video');

      if (category === 'avatar') {
        updateField('avatarUrl', url);
        success('Avatar ajoute', 'La photo de profil a ete importee.');
      } else if (category === 'cover') {
        updateField('organizerCoverImage', url);
        success('Couverture ajoutee', 'La photo de couverture a ete importee.');
      } else if (category === 'image') {
        setPortfolioImages((current) => [...current, url]);
        success('Photo ajoutee', 'La prestation a ete ajoutee a la galerie.');
      } else if (category === 'video') {
        setPortfolioVideos((current) => [...current, url]);
        success('Video ajoutee', 'La video a ete ajoutee a la galerie.');
      }
    } catch (uploadError) {
      error('Upload impossible', uploadError.message || 'Le fichier n a pas pu etre televerse.');
    } finally {
      setUploading((current) => ({ ...current, [category]: false }));
      event.target.value = '';
    }
  }

  function removePortfolioItem(type, index) {
    if (type === 'image') {
      setPortfolioImages((current) => current.filter((_, currentIndex) => currentIndex !== index));
    } else {
      setPortfolioVideos((current) => current.filter((_, currentIndex) => currentIndex !== index));
    }
    info('Media retire', 'La galerie a ete mise a jour. Pense a enregistrer.');
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch('/api/account/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        address: form.address,
        avatarUrl: form.avatarUrl,
        organizerName: form.organizerName,
        organizerCity: form.organizerCity,
        organizerAddress: form.organizerAddress,
        organizerServiceArea: form.organizerServiceArea,
        organizerDescription: form.organizerDescription,
        organizerCoverImage: form.organizerCoverImage,
        organizerPortfolioImages: portfolioImages.join('\n'),
        organizerPortfolioVideos: portfolioVideos.join('\n'),
      }),
    });

    if (res.ok) {
      success('Profil mis a jour', 'Les nouvelles informations ont ete enregistrees.');
      setTimeout(() => window.location.reload(), 700);
    } else {
      error('Mise a jour impossible', 'Le profil n a pas pu etre enregistre.');
    }
  }

  return (
    <section className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Profil</h2>
        <p className="text-slate-500">Ajoute ton avatar et, si tu es organisateur, les photos et videos de tes prestations.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-slate-100 flex items-center justify-center text-xl font-semibold text-slate-700">
              {form.avatarUrl ? <img src={form.avatarUrl} alt="Avatar" className="h-full w-full object-cover" /> : 'AV'}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-700">Photo de profil</label>
                <input type="file" accept="image/*" className="block w-full mt-2 text-sm" onChange={(e) => handleUpload(e, 'avatar')} />
              </div>
              {uploading.avatar ? <p className="text-sm text-slate-500">Upload avatar en cours...</p> : null}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Email</label>
              <input className="w-full p-3 border rounded-lg mt-1 bg-gray-50" value={form.email} disabled />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Role</label>
              <input className="w-full p-3 border rounded-lg mt-1 bg-gray-50" value={form.role} disabled />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Nom</label>
              <input className="w-full p-3 border rounded-lg mt-1" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Telephone</label>
              <input className="w-full p-3 border rounded-lg mt-1" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700">Adresse</label>
            <textarea className="w-full p-3 border rounded-lg mt-1" rows="3" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
          </div>
        </div>

        {isOrganizerUser && (
          <div className="bg-white border rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Profil organisateur</h3>
                <p className="text-sm text-slate-500 mt-1">Cette fiche sera visible par les clients avant reservation.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-violet-50 border border-violet-100 text-xs font-semibold text-violet-700">
                {form.organizerStatus || 'PENDING'}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700">Nom organisateur</label>
                <input className="w-full p-3 border rounded-lg mt-1" value={form.organizerName} onChange={(e) => updateField('organizerName', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Ville</label>
                <input className="w-full p-3 border rounded-lg mt-1" value={form.organizerCity} onChange={(e) => updateField('organizerCity', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Zone d intervention</label>
                <input className="w-full p-3 border rounded-lg mt-1" value={form.organizerServiceArea} onChange={(e) => updateField('organizerServiceArea', e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700">Photo de couverture</label>
                <input type="file" accept="image/*" className="block w-full mt-2 text-sm" onChange={(e) => handleUpload(e, 'cover')} />
                {uploading.cover ? <p className="text-sm text-slate-500 mt-2">Upload couverture en cours...</p> : null}
              </div>
            </div>

            {form.organizerCoverImage ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <img src={form.organizerCoverImage} alt="Couverture organisateur" className="h-64 w-full object-cover" />
              </div>
            ) : null}

            <div>
              <label className="text-sm font-semibold text-gray-700">Adresse organisateur</label>
              <textarea className="w-full p-3 border rounded-lg mt-1" rows="2" value={form.organizerAddress} onChange={(e) => updateField('organizerAddress', e.target.value)} />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Presentation</label>
              <textarea className="w-full p-3 border rounded-lg mt-1" rows="4" value={form.organizerDescription} onChange={(e) => updateField('organizerDescription', e.target.value)} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Ajouter des photos de prestations</label>
                  <input type="file" accept="image/*" className="block w-full mt-2 text-sm" onChange={(e) => handleUpload(e, 'image')} />
                  {uploading.image ? <p className="text-sm text-slate-500 mt-2">Upload photo en cours...</p> : null}
                </div>
                <MediaPreview items={portfolioImages} type="image" onRemove={(index) => removePortfolioItem('image', index)} />
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700">Ajouter des videos de prestations</label>
                  <input type="file" accept="video/*" className="block w-full mt-2 text-sm" onChange={(e) => handleUpload(e, 'video')} />
                  {uploading.video ? <p className="text-sm text-slate-500 mt-2">Upload video en cours...</p> : null}
                </div>
                <MediaPreview items={portfolioVideos} type="video" onRemove={(index) => removePortfolioItem('video', index)} />
              </div>
            </div>
          </div>
        )}

        <button disabled={!canSave} className="bg-violet-600 text-white px-5 py-3 rounded-lg font-semibold hover:bg-violet-700 disabled:opacity-60">
          Enregistrer
        </button>
      </form>
    </section>
  );
}
