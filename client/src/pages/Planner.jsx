import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock, House, Loader2, Pencil, Plus, ShieldCheck, SlidersHorizontal, Wand2 } from 'lucide-react';
import PlaceSearch from '../components/PlaceSearch';
import StopRow from '../components/StopRow';
import TripMap from '../components/TripMap';
import { ModePicker, PriorityPicker } from '../components/Pickers';
import { useTrip, readSavings } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { fmtDuration, fmtEuro, fmtKg } from '../lib/constants';

export default function Planner() {
  const trip = useTrip();
  const { form, setForm } = trip;
  const { prefs } = useAuth();
  const navigate = useNavigate();
  const [editStart, setEditStart] = useState(false);
  const [localError, setLocalError] = useState(null);
  const savings = readSavings();
  const favorites = prefs?.save_favorites ? prefs.favorites || [] : [];

  const { applyDefaults } = trip;
  useEffect(() => {
    applyDefaults(prefs);
  }, [prefs, applyDefaults]);

  const submit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    try {
      await trip.optimize();
      navigate('/trajet');
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const canSubmit = form.start && form.stops.length >= 2 && !trip.loading;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-10">
      <form onSubmit={submit} className="card animate-fade-up p-5 sm:p-7" noValidate>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Planifier ma journée</h1>
            <p className="mt-1 text-sm text-muted">Listez vos étapes dans n'importe quel ordre : l'IA s'occupe du reste.</p>
          </div>
          <button type="button" onClick={trip.loadDemo} className="chip border border-brand-100 bg-brand-50 !py-2 text-brand-700 hover:bg-brand-100">
            <Wand2 size={14} /> Essayer un exemple
          </button>
        </div>

        {/* Départ */}
        <section className="mb-6">
          <span className="label">Départ</span>
          {form.start && !editStart ? (
            <div className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
              <House size={20} className="shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 truncate font-semibold">{form.start.label}</span>
              <button type="button" onClick={() => setEditStart(true)} className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label="Modifier le départ">
                <Pencil size={16} />
              </button>
            </div>
          ) : (
            <PlaceSearch
              allowLocate
              favorites={favorites}
              placeholder="Domicile, adresse de départ…"
              autoFocus={editStart}
              onSelect={(p) => {
                setForm({ start: { label: p.label, lat: p.lat, lon: p.lon } });
                setEditStart(false);
              }}
            />
          )}
        </section>

        {/* Arrêts */}
        <section className="mb-6">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="label !mb-0">Mes arrêts ({form.stops.length}/6)</span>
            {form.stops.length > 1 && <span className="text-xs text-muted">L'ordre saisi sert de point de comparaison</span>}
          </div>
          {form.stops.length > 0 && (
            <ol className="mb-3 space-y-2">
              {form.stops.map((s, i) => (
                <StopRow
                  key={s.id}
                  stop={s}
                  index={i}
                  total={form.stops.length}
                  onChange={(patch) => trip.updateStop(s.id, patch)}
                  onRemove={() => trip.removeStop(s.id)}
                  onMove={(dir) => trip.moveStop(s.id, dir)}
                />
              ))}
            </ol>
          )}
          {form.stops.length < 6 ? (
            <div>
              <PlaceSearch
                favorites={favorites}
                near={form.start || undefined}
                placeholder={form.stops.length ? 'Ajouter un arrêt (mairie, école, supermarché…)' : 'Ex. : Mairie du 11e, Monoprix, école Keller…'}
                onSelect={(p) => trip.addStop(p)}
              />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <Plus size={13} /> Le type de lieu est détecté automatiquement ; ajoutez une contrainte avec le bouton <SlidersHorizontal size={13} className="inline" />.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">Maximum de 6 étapes atteint.</p>
          )}
        </section>

        {/* Date / heure */}
        <section className="mb-6 grid grid-cols-2 gap-3">
          <label>
            <span className="label">Date</span>
            <span className="relative block">
              <CalendarDays size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
              <input type="date" className="input !pl-10" value={form.date} onChange={(e) => setForm({ date: e.target.value })} required />
            </span>
          </label>
          <label>
            <span className="label">Heure de départ</span>
            <span className="relative block">
              <Clock size={17} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
              <input type="time" className="input !pl-10" value={form.time} onChange={(e) => setForm({ time: e.target.value })} required />
            </span>
          </label>
        </section>

        <section className="mb-6">
          <span className="label">Mode de transport</span>
          <ModePicker value={form.mode} onChange={(mode) => setForm({ mode })} />
        </section>

        <section className="mb-5">
          <span className="label">Ma priorité</span>
          <PriorityPicker value={form.priority} onChange={(priority) => setForm({ priority })} />
        </section>

        <label className="mb-6 flex cursor-pointer items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3">
          <span className="text-sm font-semibold">Revenir au point de départ en fin de journée</span>
          <input
            type="checkbox"
            className="h-5 w-5 accent-[#1aa86c]"
            checked={form.returnToStart}
            onChange={(e) => setForm({ returnToStart: e.target.checked })}
          />
        </label>

        {(localError || trip.error) && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">
            {localError || trip.error}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className="btn-primary w-full !py-4 text-base">
          {trip.loading ? <Loader2 size={20} className="animate-spin" /> : <ArrowRight size={20} />}
          {trip.loading ? "L'IA teste tous les ordres possibles…" : 'Optimiser mon trajet'}
        </button>
        {!canSubmit && !trip.loading && (
          <p className="mt-2 text-center text-xs text-muted">
            {!form.start ? 'Indiquez votre départ' : 'Ajoutez au moins 2 étapes'} pour lancer l'optimisation.
          </p>
        )}
        <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
          <ShieldCheck size={14} className="text-brand-600" /> Calculé puis effacé : aucun historique de trajet n'est conservé.
        </p>
      </form>

      <aside className="space-y-6">
        <div className="card h-72 overflow-hidden sm:h-96 lg:h-[460px]">
          <TripMap start={form.start} stops={form.stops} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-5">
            <p className="text-sm font-bold">Comment l'IA décide</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>• Teste tous les ordres possibles (jusqu'à 720)</li>
              <li>• Croise le trafic réel des capteurs parisiens</li>
              <li>• Évite les heures d'affluence des guichets</li>
              <li>• Respecte vos horaires et les heures d'ouverture</li>
            </ul>
          </div>
          <div className="card p-5">
            <p className="text-sm font-bold">Vos économies ce mois-ci</p>
            <p className="text-xs text-muted">Totaux conservés uniquement sur cet appareil</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-[11px] text-muted">Temps</dt>
                <dd className="font-extrabold text-cheap-600">{fmtDuration(savings.minutes)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted">Argent</dt>
                <dd className="font-extrabold text-ink">{fmtEuro(savings.euros)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted">CO₂</dt>
                <dd className="font-extrabold text-brand-600">{fmtKg(savings.co2)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </aside>
    </div>
  );
}
