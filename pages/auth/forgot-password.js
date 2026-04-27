import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage('');
    setResetUrl('');

    const res = await fetch('/api/auth/reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    const data = await res.json().catch(() => ({}));
    setMessage(data.message || 'Demande envoyee');
    if (data.resetUrl) setResetUrl(data.resetUrl);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow w-full max-w-md border">
        <h1 className="text-2xl font-bold mb-2">Reset mot de passe</h1>
        <p className="text-sm text-gray-500 mb-6">Entrez votre email pour generer un lien de reinitialisation.</p>

        <input
          className="w-full p-3 border rounded-xl mb-4"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <button className="w-full bg-violet-600 text-white py-3 rounded-xl font-semibold">
          Envoyer
        </button>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
        {resetUrl && (
          <Link href={resetUrl} className="mt-2 block text-sm text-violet-700 font-semibold">
            Ouvrir le lien de reset
          </Link>
        )}

        <Link href="/auth/signin" className="mt-4 block text-sm text-gray-600 hover:text-violet-700">
          Retour connexion
        </Link>
      </form>
    </div>
  );
}
