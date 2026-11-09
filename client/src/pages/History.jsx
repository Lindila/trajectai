import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Euro, History as HistoryIcon, Leaf, Loader2, MapPinned, RotateCw, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { readSavings, useTrip } from '../context/TripContext';
import { MODES, fmtDuration, fmtEuro, fmtKg } from '../lib/constants';
import { clearMemory, memoryOn, removeTrip, savedTrips, setMemoryOn, updateTrip } from '../lib/memory';

function useTrips() {
  const [state, setState] = useState(() => ({ on: memoryOn(), trips: savedTrips() }));
  useEffect(() => {
    const sync = () => setState({ on: memoryOn(), trips: savedTrips() });
    window.addEventListener('traject:memory', sync);
    return () => window.removeEventListener('traject:memory', sync);
  }, []);
  return state;
}

const fmtDate = (iso, time) => {
  const d = new Date(`${iso}T${time || '12:00'}`);
  return `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${time?.replace(':', 'h')}`;
};

function TripCard({ trip, onRelaunch, busy }) {
  const ModeIcon = MODES[trip.mode]?.icon || MapPinned;
  const route = [trip.start?.label?.split(' — ')[0], ...trip.order, ...(trip.returnToStart ? [trip.start?.label?.split(' — ')[0]] : [])];
  return (
    <li className="card p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <ModeIcon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-snug font-semibold">{route.join(' → ')}</p>
          <p className="mt-0.5 text-xs text-muted">{fmtDate(trip.date, trip.time)}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1">
              <Clock size={13} /> {fmtDuration(trip.totals.durationMin)}
            </span>
            <span className="flex items-center gap-1 text-cheap-600">
              <Euro size={13} /> {fmtEuro(trip.totals.cost)}
            </span>
            <span className="flex items-center gap-1 text-brand-700">
              <Leaf size={13} /> {fmtKg(trip.totals.co2)}
            </span>
            {trip.gains?.minutes > 0 && <span className="font-semibold text-brand-700">−{trip.gains.minutes} min gagnées</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateTrip(trip.id, { favorite: !trip.favorite })}
          className={`rounded-lg p-1.5 ${trip.favorite ? 'text-cheap-500' : 'text-muted hover:text-cheap-500'}`}
          aria-label={trip.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          aria-pressed={trip.favorite}
        >
          <Star size={18} fill={trip.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" disabled={busy} onClick={() => onRelaunch(trip)} className="btn-primary flex-1 !py-2.5 text-sm">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />} Relancer pour aujourd’hui
        </button>
        <button type="button" onClick={() => removeTrip(trip.id)} className="btn-ghost !px-3 !py-2.5 text-sm" aria-label="Supprimer ce trajet">
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}

export default function History() {
  const { result, loadTrip } = useTrip();
  const { on, trips } = useTrips();
  const [tab, setTab] = useState('recent');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const savings = readSavings();
  const shown = tab === 'fav' ? trips.filter((t) => t.favorite) : trips;

  const relaunch = async (trip) => {
    setBusy(trip.id);
    setError(null);
    try {
      await loadTrip(trip);
      navigate('/trajet');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">Mes trajets</h1>
        <p className="mt-1 text-muted">Retrouvez et relancez vos journées en un geste.</p>
      </header>

      {result ? (
        <Link to="/trajet" className="card flex items-center gap-4 border-brand-400 p-4 hover:shadow-float">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500 text-white">
            <MapPinned size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold tracking-wider text-brand-700 uppercase">Trajet en cours</p>
            <p className="truncate font-semibold">{result.plan.steps.map((s) => s.label).join(' → ')}</p>
            <p className="text-xs text-muted">
              {fmtDuration(result.plan.totals.durationMin)} · fin à {result.plan.totals.endTime}
            </p>
          </div>
          <ArrowRight size={20} className="shrink-0 text-muted" />
        </Link>
      ) : (
        <Link to="/planifier" className="btn-primary w-full">
          Planifier une nouvelle journée <ArrowRight size={18} />
        </Link>
      )}

      {!on ? (
        <section className="card p-6 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <HistoryIcon size={26} />
          </span>
          <h2 className="mt-4 text-lg font-extrabold">L’historique est désactivé</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Par défaut, TrajectAI ne garde aucun trajet. Activez l’historique pour retrouver vos journées et adresses récentes :
            elles resteront <strong className="text-ink">uniquement sur cet appareil</strong>, jamais sur nos serveurs.
          </p>
          <button type="button" onClick={() => setMemoryOn(true)} className="btn-brand mt-5">
            Activer l’historique sur cet appareil
          </button>
        </section>
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="grid grid-cols-2 rounded-xl bg-white p-1 shadow-card" role="tablist">
              {[
                ['recent', `Récents (${trips.length})`],
                ['fav', `Favoris (${trips.filter((t) => t.favorite).length})`],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  onClick={() => setTab(k)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-ink text-white' : 'text-muted'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button type="button" onClick={clearMemory} className="text-xs font-semibold text-red-600 hover:underline">
              Tout effacer
            </button>
          </div>
          {error && <p className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          {shown.length ? (
            <ul className="space-y-3">
              {shown.map((t) => (
                <TripCard key={t.id} trip={t} busy={busy === t.id} onRelaunch={relaunch} />
              ))}
            </ul>
          ) : (
            <p className="card p-6 text-center text-sm text-muted">
              {tab === 'fav' ? 'Touchez l’étoile d’un trajet pour le garder en favori.' : 'Vos prochains trajets optimisés apparaîtront ici.'}
            </p>
          )}
          <p className="mt-3 flex items-center gap-2 text-xs text-muted">
            <ShieldCheck size={14} className="text-brand-600" /> Stocké uniquement sur cet appareil ·{' '}
            <button type="button" onClick={() => setMemoryOn(false)} className="font-semibold underline">
              désactiver et tout effacer
            </button>
          </p>
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-extrabold">Vos économies ce mois-ci</h2>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-cheap-50 p-3">
            <dd className="text-lg font-extrabold text-cheap-600">{fmtDuration(savings.minutes)}</dd>
            <dt className="text-xs text-muted">Temps</dt>
          </div>
          <div className="rounded-2xl bg-canvas p-3">
            <dd className="text-lg font-extrabold">{fmtEuro(savings.euros)}</dd>
            <dt className="text-xs text-muted">Argent</dt>
          </div>
          <div className="rounded-2xl bg-brand-50 p-3">
            <dd className="text-lg font-extrabold text-brand-700">{fmtKg(savings.co2)}</dd>
            <dt className="text-xs text-muted">CO₂ évité</dt>
          </div>
        </dl>
      </section>
    </div>
  );
}
