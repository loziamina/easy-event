import { useRouter } from 'next/router';
import { useState } from 'react';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: router.query.token, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMessage('Mot de passe mis a jour.');
      setTimeout(() => router.push('/auth/signin'), 700);
    } else {
      setMessage(data.message || 'Lien invalide');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow w-full max-w-md border">
        <h1 className="text-2xl font-bold mb-4">Nouveau mot de passe</h1>

        <input
          type="password"
          className="w-full p-3 border rounded-xl mb-4"
          placeholder="Nouveau mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="w-full bg-violet-600 text-white py-3 rounded-xl font-semibold">
          Mettre a jour
        </button>

        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}

        <Link href="/auth/signin" className="mt-4 block text-sm text-gray-600 hover:text-violet-700">
          Retour connexion
        </Link>
      </form>
    </div>
  );
}
