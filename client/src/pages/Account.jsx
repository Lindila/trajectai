import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Loader2, LogOut, Star, Trash2, UserRound, X } from 'lucide-react';
import { DEFAULT_PREFS, useAuth } from '../context/AuthContext';
import { readSavings } from '../context/TripContext';
import { ModePicker, PriorityPicker } from '../components/Pickers';
import PlaceSearch from '../components/PlaceSearch';
import { fmtDuration, fmtEuro, fmtKg } from '../lib/constants';

export default function Account() {
  const { enabled, ready, user, prefs, savePrefs, signOut, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [favName, setFavName] = useState('');
  const savings = readSavings();

  useEffect(() => {
    if (ready && (!enabled || !user)) navigate('/connexion', { replace: true });
  }, [ready, enabled, user, navigate]);
  useEffect(() => {
    if (prefs) setDraft(prefs);
  }, [prefs]);

  if (!user) return null;

  const save = async (patch = {}) => {
    setSaving(true);
    setMsg(null);
    try {
      const next = await savePrefs({ ...draft, ...patch });
      setDraft(next);
      setMsg({ ok: true, text: 'Préférences enregistrées.' });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setSaving(false);
    }
  };

  const exportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      account: { email: user.email, createdAt: user.created_at },
      preferences: prefs || DEFAULT_PREFS,
      note: "TrajectAI ne conserve aucun historique de trajet : il n'y a donc aucun trajet à exporter.",
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mes-donnees-trajectai.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = async () => {
    try {
      await deleteAccount();
      navigate('/', { replace: true });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <header className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ink text-white">
          <UserRound size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold">Mon compte</h1>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <button type="button" onClick={signOut} className="btn-ghost !px-4 !py-2.5 text-sm">
          <LogOut size={16} /> <span className="hidden sm:inline">Se déconnecter</span>
        </button>
      </header>

      <section className="card p-6">
        <h2 className="font-extrabold">Vos économies ce mois-ci</h2>
        <p className="text-xs text-muted">Totaux agrégés, stockés uniquement sur cet appareil ({savings.trips} journée{savings.trips > 1 ? 's' : ''} guidée{savings.trips > 1 ? 's' : ''}).</p>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-cheap-50 p-3">
            <dd className="text-xl font-extrabold text-cheap-600">{fmtDuration(savings.minutes)}</dd>
            <dt className="text-xs text-muted">Temps économisé</dt>
          </div>
          <div className="rounded-2xl bg-canvas p-3">
            <dd className="text-xl font-extrabold">{fmtEuro(savings.euros)}</dd>
            <dt className="text-xs text-muted">Argent économisé</dt>
          </div>
          <div className="rounded-2xl bg-brand-50 p-3">
            <dd className="text-xl font-extrabold text-brand-700">{fmtKg(savings.co2)}</dd>
            <dt className="text-xs text-muted">CO₂ évité</dt>
          </div>
        </dl>
      </section>

      <section className="card space-y-5 p-6">
        <h2 className="font-extrabold">Mes préférences</h2>
        <div>
          <span className="label">Priorité par défaut</span>
          <PriorityPicker value={draft.default_priority} onChange={(v) => setDraft((d) => ({ ...d, default_priority: v }))} />
        </div>
        <div>
          <span className="label">Mode par défaut</span>
          <ModePicker value={draft.default_mode} onChange={(v) => setDraft((d) => ({ ...d, default_mode: v }))} />
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
          <span className="text-sm font-semibold">Réponses vocales de l'assistant</span>
          <input type="checkbox" className="h-5 w-5 accent-[#1aa86c]" checked={draft.voice_enabled} onChange={(e) => setDraft((d) => ({ ...d, voice_enabled: e.target.checked }))} />
        </label>
        <button type="button" onClick={() => save()} disabled={saving} className="btn-primary w-full sm:w-auto">
          {saving && <Loader2 size={17} className="animate-spin" />} Enregistrer
        </button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-brand-700' : 'text-red-600'}`}>{msg.text}</p>}
      </section>

      <section className="card space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-extrabold">Lieux favoris</h2>
            <p className="text-sm text-muted">Maison, école, travail… Enregistrés uniquement si vous activez cette option.</p>
          </div>
          <input
            type="checkbox"
            role="switch"
            aria-label="Enregistrer mes lieux favoris"
            className="mt-1 h-5 w-5 shrink-0 accent-[#1aa86c]"
            checked={draft.save_favorites}
            onChange={(e) => save({ save_favorites: e.target.checked, favorites: e.target.checked ? draft.favorites : [] })}
          />
        </div>
        {draft.save_favorites && (
          <>
            <ul className="flex flex-wrap gap-2">
              {draft.favorites.map((f, i) => (
                <li key={`${f.lat}-${i}`} className="chip border border-line bg-white !py-2 text-ink">
                  <Star size={13} className="text-cheap-500" /> {f.name || f.label}
                  <button
                    type="button"
                    onClick={() => save({ favorites: draft.favorites.filter((_, j) => j !== i) })}
                    className="ml-1 text-muted hover:text-red-600"
                    aria-label={`Supprimer ${f.name || f.label}`}
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
              {!draft.favorites.length && <li className="text-sm text-muted">Aucun favori pour l'instant.</li>}
            </ul>
            {draft.favorites.length < 10 && (
              <div className="grid gap-2 sm:grid-cols-[140px_1fr]">
                <input className="input" placeholder="Nom (ex. Maison)" value={favName} maxLength={30} onChange={(e) => setFavName(e.target.value)} />
                <PlaceSearch
                  placeholder="Adresse du favori"
                  onSelect={(p) => {
                    save({ favorites: [...draft.favorites, { name: favName.trim() || p.label, label: p.label, lat: p.lat, lon: p.lon, category: p.category }] });
                    setFavName('');
                  }}
                />
              </div>
            )}
          </>
        )}
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-extrabold">Mes données</h2>
        <p className="text-sm text-muted">
          Aucun trajet n'est stocké. Vous pouvez télécharger tout ce que nous savons de vous, ou supprimer définitivement votre compte.{' '}
          <Link to="/confidentialite" className="font-semibold text-brand-700 underline">
            En savoir plus
          </Link>
        </p>
        <button type="button" onClick={exportData} className="btn-ghost">
          <Download size={17} /> Exporter mes données (JSON)
        </button>
        <div className="rounded-2xl border border-red-100 bg-red-50/50 p-4">
          <p className="text-sm font-bold text-red-700">Supprimer mon compte</p>
          <p className="mt-1 text-xs text-red-700/80">Action immédiate et irréversible. Tapez SUPPRIMER pour confirmer.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="input !border-red-100" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="SUPPRIMER" aria-label="Confirmation de suppression" />
            <button type="button" disabled={confirm !== 'SUPPRIMER'} onClick={remove} className="btn shrink-0 bg-red-600 text-white hover:bg-red-700">
              <Trash2 size={17} /> Supprimer
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
