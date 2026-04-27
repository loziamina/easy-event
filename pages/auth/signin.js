import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import Link from 'next/link';
import { useToast } from '../../components/ToastProvider';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { error, success } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();

    const res = await signIn('credentials', {
      redirect: false,
      email: email.trim().toLowerCase(),
      password,
    });

    if (res?.ok) {
      success('Connexion reussie', 'Bienvenue sur EasyEvent.');
      router.push('/');
    } else {
      error('Echec de la connexion', 'Verifie ton email et ton mot de passe.');
    }
  }

  return (
    <div className="auth-shell flex items-center justify-center px-4 py-10">
      <div className="auth-slideshow">
        <div className="auth-slide auth-slide-1" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=80')" }} />
        <div className="auth-slide auth-slide-2" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1600&q=80')" }} />
        <div className="auth-slide auth-slide-3" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1505236858219-8359eb29e329?auto=format&fit=crop&w=1600&q=80')" }} />
      </div>
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-panel w-full max-w-5xl grid lg:grid-cols-[1.15fr_0.85fr] gap-8 items-center">
        <div className="hidden lg:block px-6">
          <p className="inline-flex items-center rounded-full border border-white/60 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-700 backdrop-blur">
            Plateforme multi-organisateurs
          </p>
          <h1 className="mt-6 text-5xl font-bold leading-tight text-slate-900">
            Organiser, reserver et suivre chaque evenement dans un espace simple.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Trouve un organisateur proche, valide tes demandes, pilote les devis et garde une vue claire sur le planning.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="surface-card auth-panel w-full max-w-md justify-self-center rounded-[28px] p-7">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Connexion</p>
            <h2 className="mt-2 text-3xl font-bold app-gradient-text">Se connecter</h2>
            <p className="mt-2 text-sm text-slate-500">Retrouve ton espace et reprends ton organisation la ou tu l'as laissee.</p>
          </div>

          <input
            className="w-full p-3.5 border rounded-2xl mb-3 bg-white/80"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="w-full p-3.5 border rounded-2xl mb-4 bg-white/80"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="w-full py-3.5 rounded-2xl font-semibold text-white" style={{ background: 'var(--gradient-primary)', boxShadow: 'var(--shadow-md)' }}>
            Se connecter
          </button>

          <div className="mt-4 text-sm text-center">
            Pas encore de compte ?{' '}
            <Link href="/auth/signup" className="font-semibold text-slate-900 hover:text-[color:var(--primary-soft)]">
              S'inscrire
            </Link>
          </div>

          <div className="mt-2 text-sm text-center">
            <Link href="/auth/forgot-password" className="text-slate-500 hover:text-[color:var(--primary-soft)]">
              Mot de passe oublie ?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
