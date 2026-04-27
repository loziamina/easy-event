import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useToast } from '../../components/ToastProvider';

const ACCOUNT_TYPES = {
  CLIENT: 'CLIENT',
  ORGANIZER: 'ORGANIZER',
};

const initialForm = {
  email: '',
  password: '',
  name: '',
  phone: '',
  address: '',
  organizerName: '',
  organizerCity: '',
  organizerAddress: '',
  organizerServiceArea: '',
  organizerDescription: '',
};

export default function SignUpPage() {
  const [form, setForm] = useState(initialForm);
  const [accountType, setAccountType] = useState(ACCOUNT_TYPES.CLIENT);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { error, success } = useToast();

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        accountType,
      }),
    });

    setLoading(false);

    if (res.ok) {
      success('Compte cree', "Tu peux maintenant te connecter.");
      router.push('/auth/signin');
      return;
    }

    const data = await res.json().catch(() => ({}));
    error("Erreur d'inscription", data?.error || data?.message || "Une erreur est survenue.");
  }

  const isOrganizer = accountType === ACCOUNT_TYPES.ORGANIZER;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow w-full max-w-2xl border">
        <h1 className="text-2xl font-bold mb-1">Creer un compte</h1>
        <p className="text-sm text-gray-500 mb-6">
          Choisis le bon type de compte pour demarrer sur EasyEvent.
        </p>

        <div className="mb-6">
          <p className="text-sm font-semibold mb-2">Je suis</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setAccountType(ACCOUNT_TYPES.CLIENT)}
              className={`rounded-xl border px-4 py-3 text-left ${
                !isOrganizer ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-gray-200'
              }`}
            >
              <span className="block font-semibold">Client</span>
              <span className="text-sm text-gray-500">Je cherche un organisateur pres de chez moi.</span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType(ACCOUNT_TYPES.ORGANIZER)}
              className={`rounded-xl border px-4 py-3 text-left ${
                isOrganizer ? 'border-violet-600 bg-violet-50 text-violet-700' : 'border-gray-200'
              }`}
            >
              <span className="block font-semibold">Organisateur</span>
              <span className="text-sm text-gray-500">Je cree mon espace pro et mon catalogue.</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold">Nom</label>
            <input className="w-full p-3 border rounded-xl mt-1" value={form.name} onChange={(e) => updateField('name', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold">Telephone</label>
            <input className="w-full p-3 border rounded-xl mt-1" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm font-semibold">Adresse</label>
            <input className="w-full p-3 border rounded-xl mt-1" value={form.address} onChange={(e) => updateField('address', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold">Email</label>
            <input className="w-full p-3 border rounded-xl mt-1" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold">Mot de passe</label>
            <input type="password" className="w-full p-3 border rounded-xl mt-1" value={form.password} onChange={(e) => updateField('password', e.target.value)} />
          </div>
        </div>

        {isOrganizer && (
          <div className="mt-6 border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Espace organisateur</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold">Nom de l'organisateur</label>
                <input className="w-full p-3 border rounded-xl mt-1" value={form.organizerName} onChange={(e) => updateField('organizerName', e.target.value)} required={isOrganizer} />
              </div>
              <div>
                <label className="text-sm font-semibold">Ville</label>
                <input className="w-full p-3 border rounded-xl mt-1" value={form.organizerCity} onChange={(e) => updateField('organizerCity', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold">Adresse professionnelle</label>
                <input className="w-full p-3 border rounded-xl mt-1" value={form.organizerAddress} onChange={(e) => updateField('organizerAddress', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold">Zone d'intervention</label>
                <input className="w-full p-3 border rounded-xl mt-1" placeholder="Paris, Ile-de-France, 50 km autour de Lyon..." value={form.organizerServiceArea} onChange={(e) => updateField('organizerServiceArea', e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold">Description</label>
                <textarea className="w-full p-3 border rounded-xl mt-1 min-h-[110px]" value={form.organizerDescription} onChange={(e) => updateField('organizerDescription', e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4">
              Le compte organisateur est cree immediatement, puis reste en attente de validation plateforme avant d'etre visible par les clients.
            </p>
          </div>
        )}

        <button disabled={loading} className="w-full bg-violet-600 text-white py-3 rounded-xl font-semibold hover:bg-violet-700 mt-6 disabled:opacity-60">
          {loading ? 'Creation en cours...' : "S'inscrire"}
        </button>

        <div className="text-sm text-gray-600 mt-4 flex items-center justify-between">
          <span>Deja un compte ?</span>
          <Link className="text-violet-700 font-semibold hover:underline" href="/auth/signin">
            Se connecter
          </Link>
        </div>
      </form>
    </div>
  );
}
