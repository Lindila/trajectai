import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import Logo from '../components/Logo';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const LEVELS = [
  ['Trop faible', 'bg-red-500'],
  ['Faible', 'bg-red-400'],
  ['Moyen', 'bg-cheap-500'],
  ['Bon', 'bg-brand-400'],
  ['Excellent', 'bg-brand-600'],
];

const translate = (msg) => {
  if (/invalid login/i.test(msg)) return 'Email ou mot de passe incorrect.';
  if (/already registered/i.test(msg)) return 'Un compte existe déjà avec cet email.';
  if (/email not confirmed/i.test(msg)) return 'Confirmez votre email via le lien reçu avant de vous connecter.';
  if (/rate limit/i.test(msg)) return 'Trop de tentatives, réessayez dans quelques minutes.';
  return msg;
};

export default function Auth() {
  const { enabled, user } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const s = strength(password);

  useEffect(() => {
    if (user) navigate('/compte', { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === 'signup' && s < 2) return setError('Choisissez un mot de passe plus robuste (8 caractères minimum, avec chiffres et majuscules).');
    if (mode === 'signup' && !consent) return setError('Veuillez accepter la politique de confidentialité.');
    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      } else {
        const { data, error: err } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/compte` } });
        if (err) throw err;
        if (!data.session) setInfo('Compte créé ! Consultez votre boîte mail pour confirmer votre adresse.');
      }
    } catch (err) {
      setError(translate(err.message));
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    if (!email) return setError('Saisissez votre email pour recevoir un lien de réinitialisation.');
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/compte` });
    setInfo('Si un compte existe, un lien de réinitialisation vient d’être envoyé.');
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-10 sm:py-16">
      <div className="card animate-fade-up p-6 sm:p-8">
        <Logo />
        <h1 className="mt-6 text-2xl font-extrabold">{mode === 'login' ? 'Bon retour !' : 'Créer mon compte'}</h1>
        <p className="mt-1 text-sm text-muted">Un compte sert uniquement à garder vos préférences. Vous pouvez planifier sans compte.</p>

        {!enabled ? (
          <div className="mt-6 rounded-xl bg-cheap-50 p-4 text-sm text-cheap-600">
            <p className="font-bold">Comptes non configurés</p>
            <p className="mt-1">
              Ajoutez <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans <code>client/.env</code> (voir le README) pour activer
              l'inscription.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 rounded-xl bg-canvas p-1" role="tablist">
              {[
                ['login', 'Connexion'],
                ['signup', 'Inscription'],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={mode === k}
                  onClick={() => {
                    setMode(k);
                    setError(null);
                    setInfo(null);
                  }}
                  className={`rounded-lg py-2 text-sm font-semibold ${mode === k ? 'bg-white text-ink shadow-card' : 'text-muted'}`}
                >
                  {l}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block">
                <span className="label">Email</span>
                <span className="relative block">
                  <Mail size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                  <input type="email" required autoComplete="email" className="input !pl-10" value={email} onChange={(e) => setEmail(e.target.value)} />
                </span>
              </label>
              <label className="block">
                <span className="label">Mot de passe</span>
                <span className="relative block">
                  <Lock size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
                  <input
                    type={show ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="input !pr-11 !pl-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-ink"
                    aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  >
                    {show ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              {mode === 'signup' && password && (
                <div>
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${i < s ? LEVELS[s][1] : 'bg-line'}`} />
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted">Robustesse : {LEVELS[s][0]}</p>
                </div>
              )}

              {mode === 'signup' && (
                <label className="flex items-start gap-2 text-sm text-muted">
                  <input type="checkbox" className="mt-1 accent-[#1aa86c]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>
                    J'ai lu la{' '}
                    <Link to="/confidentialite" className="font-semibold text-brand-700 underline">
                      politique de confidentialité
                    </Link>
                    . Seuls mon email, mon mot de passe haché et mes préférences seront conservés.
                  </span>
                </label>
              )}

              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              {info && <p className="rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-700">{info}</p>}

              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading && <Loader2 size={18} className="animate-spin" />}
                {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </button>
              {mode === 'login' && (
                <button type="button" onClick={reset} className="w-full text-center text-sm font-semibold text-muted hover:text-ink">
                  Mot de passe oublié ?
                </button>
              )}
            </form>
          </>
        )}
        <p className="mt-6 flex items-center gap-2 text-xs text-muted">
          <ShieldCheck size={14} className="text-brand-600" /> Mot de passe haché (bcrypt), connexion chiffrée, aucune donnée de trajet.
        </p>
      </div>
    </div>
  );
}
