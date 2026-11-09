import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  Euro,
  House,
  Info,
  Leaf,
  Lightbulb,
  Loader2,
  MessageCircle,
  Navigation,
  RotateCcw,
  Timer,
  Trash2,
  TrendingDown,
  Users,
} from 'lucide-react';
import TripMap from '../components/TripMap';
import GuidancePanel from '../components/GuidancePanel';
import WeatherCard, { WEATHER_ICONS } from '../components/WeatherCard';
import { ModePicker, PriorityPicker } from '../components/Pickers';
import { useTrip } from '../context/TripContext';
import { CATEGORIES, MODES, PRIORITIES, fmtDuration, fmtEuro, fmtKg } from '../lib/constants';
import { openAssistant } from '../lib/speech';

function Stat({ icon: Icon, value, label, tone }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-canvas px-3 py-3 sm:px-4">
      <span className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <Icon size={18} className={tone} />
        <span className="text-base font-extrabold tracking-tight whitespace-nowrap sm:text-xl">{value}</span>
      </span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

const OPTION_CARDS = [
  { tag: 'fastest', title: 'Plus rapide', icon: Timer, cls: 'border-brand-100 bg-brand-50/60', badge: 'bg-brand-500', metric: (t) => fmtDuration(t.durationMin) },
  { tag: 'cheapest', title: 'Moins cher', icon: Euro, cls: 'border-cheap-50 bg-cheap-50/70', badge: 'bg-cheap-500', metric: (t) => fmtEuro(t.cost) },
  { tag: 'greenest', title: 'Moins polluant', icon: Leaf, cls: 'border-brand-100 bg-eco-50', badge: 'bg-brand-700', metric: (t) => fmtKg(t.co2) },
];

export default function Result() {
  const trip = useTrip();
  const { result, loading, guidance } = trip;
  const navigate = useNavigate();
  const [livePos, setLivePos] = useState(null);
  const [err, setErr] = useState(null);
  const onPosition = useCallback((p) => setLivePos(p), []);

  if (!result) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Navigation size={30} />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">Aucun trajet en cours</h1>
        <p className="mt-2 text-muted">Vos trajets ne sont jamais conservés : planifiez votre journée pour obtenir un itinéraire optimisé.</p>
        <Link to="/planifier" className="btn-primary mt-6">
          Planifier ma journée
        </Link>
      </div>
    );
  }

  const { plan, gains, tags, options } = result;
  const steps = plan.steps;
  const ModeIcon = MODES[result.mode].icon;
  const run = async (overrides) => {
    setErr(null);
    try {
      await trip.optimize(overrides);
    } catch (e) {
      setErr(e.message);
    }
  };
  const move = (i, dir) => {
    const order = steps.map((s) => s.id);
    const j = i + dir;
    [order[i], order[j]] = [order[j], order[i]];
    run({ order });
  };
  const inGuidance = guidance && !guidance.done;
  const activeIndex = guidance ? guidance.index : -1;

  return (
    <div className="mx-auto max-w-7xl px-0 sm:px-6 lg:py-8">
      <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-6">
        {/* Carte */}
        <div className="relative h-[42vh] min-h-[280px] overflow-hidden sm:rounded-2xl lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)] lg:border lg:border-line lg:shadow-card">
          <TripMap
            start={result.startPlace}
            stops={steps}
            geometry={result.geometry}
            activeIndex={activeIndex}
            doneUntil={guidance ? guidance.index : -1}
            livePosition={livePos}
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex items-center justify-between p-3">
            <button
              type="button"
              onClick={() => navigate('/planifier')}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-card"
              aria-label="Modifier mes étapes"
            >
              <ArrowLeft size={20} />
            </button>
            <span className="pointer-events-auto chip bg-white !py-2 text-ink shadow-card">
              <ModeIcon size={15} /> {MODES[result.mode].label}
            </span>
          </div>
          {loading && (
            <div className="absolute inset-0 z-[600] flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
              <span className="chip bg-ink !px-4 !py-2.5 text-sm text-white">
                <Loader2 size={16} className="animate-spin" /> Recalcul…
              </span>
            </div>
          )}
        </div>

        {/* Panneau */}
        <div className="relative z-10 -mt-5 space-y-5 rounded-t-3xl bg-canvas px-4 pt-5 pb-8 sm:px-0 lg:mt-0 lg:rounded-none lg:pt-0">
          {inGuidance || guidance?.done ? (
            <GuidancePanel result={result} guidance={guidance} arrive={trip.arrive} stop={trip.stopGuidance} onPosition={onPosition} />
          ) : null}

          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-xl font-extrabold">{result.manual ? 'Trajet personnalisé' : 'Trajet optimisé'}</h1>
              <span className="chip bg-brand-50 text-brand-700">
                {(() => {
                  const P = PRIORITIES[result.priority];
                  return (
                    <>
                      <P.icon size={13} /> {P.label}
                    </>
                  );
                })()}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat icon={Clock} value={fmtDuration(plan.totals.durationMin)} label={`Fin à ${plan.totals.endTime}`} tone="text-ink" />
              <Stat icon={Euro} value={fmtEuro(plan.totals.cost)} label="Coût estimé" tone="text-cheap-500" />
              <Stat icon={Leaf} value={fmtKg(plan.totals.co2)} label="CO₂ estimé" tone="text-brand-600" />
            </div>

            {!result.manual && (gains.minutes > 0 || gains.euros > 0 || gains.co2 > 0) && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-brand-700">
                <TrendingDown size={20} className="mt-0.5 shrink-0" />
                <p className="text-sm">
                  <strong className="font-extrabold">Gain par rapport à votre ordre : </strong>
                  {[
                    gains.minutes > 0 && `${gains.minutes} min`,
                    gains.euros > 0 && fmtEuro(gains.euros),
                    gains.co2 > 0 && `${fmtKg(gains.co2)} de CO₂`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            )}

            <ul className="mt-4 space-y-2 text-sm text-muted">
              {result.summary.map((s) => (
                <li key={s} className="flex gap-2">
                  <Info size={16} className="mt-0.5 shrink-0 text-brand-600" />
                  {s}
                </li>
              ))}
              {result.tip && (
                <li className="flex gap-2 rounded-xl bg-cheap-50 px-3 py-2 text-cheap-600">
                  <Lightbulb size={16} className="mt-0.5 shrink-0" />
                  <span>
                    {result.tip.text}{' '}
                    <button
                      type="button"
                      className="font-bold underline"
                      onClick={() => run({ time: result.tip.departure.replace('h', ':').padStart(5, '0') })}
                    >
                      Appliquer
                    </button>
                  </span>
                </li>
              )}
            </ul>

            {result.manual && (
              <button type="button" onClick={() => run({})} className="btn-ghost mt-4 w-full !py-2.5 text-sm">
                <RotateCcw size={16} /> Revenir à l'ordre optimal
              </button>
            )}

            {!inGuidance && (
              <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                <button type="button" onClick={trip.startGuidance} className="btn-primary !py-3.5">
                  <Navigation size={18} className="text-brand-400" /> Démarrer le guidage vocal
                </button>
                <button type="button" onClick={() => openAssistant()} className="btn-ghost !px-4" aria-label="Poser une question à Traject">
                  <MessageCircle size={20} />
                </button>
              </div>
            )}
            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
          </section>

          <WeatherCard weather={result.weather} currentMode={result.mode} loading={loading} onSwitch={(mode) => run({ mode })} />

          {/* Contrôle */}
          <section className="card space-y-4 p-5">
            <div>
              <h2 className="text-sm font-bold">Changer ma priorité</h2>
              <p className="mb-3 text-xs text-muted">Le calcul est relancé instantanément.</p>
              <PriorityPicker compact value={result.priority} onChange={(priority) => run({ priority })} />
            </div>
            <div>
              <h2 className="mb-3 text-sm font-bold">Mode de transport</h2>
              <ModePicker value={result.mode} onChange={(mode) => run({ mode })} />
            </div>
          </section>

          {/* Étapes */}
          <section className="card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-extrabold">Votre journée</h2>
              <span className="text-xs text-muted">Flèches : réordonner vous-même</span>
            </div>
            <ol className="relative">
              <li className="flex gap-3 pb-5">
                <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                  <House size={17} />
                </span>
                <div className="min-w-0 pt-1">
                  <p className="font-semibold">Départ · {result.startPlace.label}</p>
                  <p className="text-xs text-muted">{steps[0] && `${steps[0].legMin} min jusqu'à la 1re étape`}</p>
                </div>
              </li>
              {steps.map((s, i) => {
                const cat = CATEGORIES[s.category] || CATEGORIES.autre;
                const Icon = cat.icon;
                const active = i === activeIndex && inGuidance;
                return (
                  <li key={s.id} className="relative flex gap-3 pb-5">
                    <span className="absolute top-[-20px] bottom-0 left-[17px] w-0.5 bg-line" aria-hidden="true" />
                    <span
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white ${active ? 'ring-4 ring-brand-100' : ''}`}
                      style={{ background: guidance && i < guidance.index ? '#94a3b8' : cat.color }}
                    >
                      {i + 1}
                    </span>
                    <div className={`min-w-0 flex-1 rounded-2xl border p-3.5 ${active ? 'border-brand-400 bg-brand-50/40' : 'border-line'}`}>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 font-bold">
                            <Icon size={15} style={{ color: cat.color }} className="shrink-0" />
                            <span className="truncate">{s.label}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            {s.legMode === 'walk' && result.mode !== 'walk' ? 'à pied' : MODES[result.mode].short.toLowerCase()} · {s.legMin} min ·{' '}
                            {String(s.legKm).replace('.', ',')} km
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg leading-none font-extrabold">{s.arrival}</p>
                          <p className="text-[11px] text-muted">arrivée</p>
                        </div>
                        {!inGuidance && (
                          <div className="-mr-1 flex flex-col">
                            <button type="button" disabled={i === 0 || loading} onClick={() => move(i, -1)} className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-20" aria-label={`Avancer ${s.label}`}>
                              <ChevronUp size={18} />
                            </button>
                            <button
                              type="button"
                              disabled={i === steps.length - 1 || loading}
                              onClick={() => move(i, 1)}
                              className="rounded p-0.5 text-muted hover:text-ink disabled:opacity-20"
                              aria-label={`Reculer ${s.label}`}
                            >
                              <ChevronDown size={18} />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-ink/85">{s.explanation}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {s.queueMin > 0 && (
                          <span className={`chip ${s.busyPct >= 70 ? 'bg-red-50 text-red-700' : s.busyPct >= 40 ? 'bg-cheap-50 text-cheap-600' : 'bg-brand-50 text-brand-700'}`}>
                            <Users size={12} /> ~{s.queueMin} min d'attente · affluence {s.busyPct} %
                          </span>
                        )}
                        {s.waitMin > 0 && (
                          <span className="chip bg-canvas text-muted">
                            <Clock size={12} /> {s.waitMin} min {s.waitReason === 'ouverture' ? "avant l'ouverture" : 'd’attente (votre contrainte)'}
                          </span>
                        )}
                        <span className="chip bg-canvas text-muted">Sur place {s.duration} min · départ {s.departure}</span>
                        {s.items > 0 && (
                          <span className="chip bg-brand-50 text-brand-700">
                            {s.items} article{s.items > 1 ? 's' : ''}
                          </span>
                        )}
                        {s.weather &&
                          (() => {
                            const WIcon = WEATHER_ICONS[s.weather.icon];
                            return (
                              <span className={`chip ${s.weather.pop >= 50 ? 'bg-blue-50 text-blue-700' : 'bg-canvas text-muted'}`} title={s.weather.label}>
                                {WIcon && <WIcon size={12} />} {s.weather.temp} °C{s.weather.pop >= 30 ? ` · pluie ${s.weather.pop} %` : ''}
                              </span>
                            );
                          })()}
                      </div>
                      {s.warnings.map((w) => (
                        <p key={w} className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700">
                          <AlertTriangle size={14} className="mt-px shrink-0" /> {w}
                        </p>
                      ))}
                      <button type="button" onClick={() => openAssistant(`Pourquoi ${s.label} est placé ici ?`)} className="mt-2 text-xs font-semibold text-brand-700 hover:underline">
                        Demander à Traject pourquoi →
                      </button>
                    </div>
                  </li>
                );
              })}
              {plan.end && (
                <li className="relative flex gap-3">
                  <span className="absolute top-[-20px] left-[17px] h-5 w-0.5 bg-line" aria-hidden="true" />
                  <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
                    <House size={17} />
                  </span>
                  <div className="pt-1">
                    <p className="font-semibold">Retour · {plan.end.arrival}</p>
                    <p className="text-xs text-muted">
                      {plan.end.legMin} min · {String(plan.end.legKm).replace('.', ',')} km
                    </p>
                  </div>
                </li>
              )}
            </ol>
          </section>

          {/* Comparaison */}
          <section className="card p-5">
            <h2 className="text-lg font-extrabold">Comparer les options</h2>
            <p className="mb-4 text-sm text-muted">Meilleur ordre calculé pour chaque mode. Touchez une option pour l'appliquer.</p>
            <div className="space-y-3">
              {OPTION_CARDS.map(({ tag, title, icon: Icon, cls, badge, metric }) => {
                const o = options.find((x) => x.mode === tags[tag]);
                if (!o) return null;
                const MIcon = MODES[o.mode].icon;
                const current = o.mode === result.mode;
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => !current && run({ mode: o.mode })}
                    className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition hover:shadow-card ${cls} ${current ? 'ring-2 ring-ink' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-extrabold">
                        <Icon size={17} /> {title}
                        {current && <span className="chip bg-ink !py-0.5 text-[10px] text-white">Actuel</span>}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                        <MIcon size={15} /> {o.label}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {fmtEuro(o.totals.cost)} · {fmtKg(o.totals.co2)} CO₂ · {String(o.totals.km).replace('.', ',')} km
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-extrabold text-white ${badge}`}>{metric(o.totals)}</span>
                  </button>
                );
              })}
            </div>
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-semibold text-muted">Voir tous les modes</summary>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="py-1 font-semibold">Mode</th>
                    <th className="py-1 font-semibold">Durée</th>
                    <th className="py-1 font-semibold">Coût</th>
                    <th className="py-1 font-semibold">CO₂</th>
                  </tr>
                </thead>
                <tbody>
                  {options.map((o) => (
                    <tr key={o.mode} className="border-t border-line">
                      <td className="py-2 font-semibold">{o.label}</td>
                      <td>{fmtDuration(o.totals.durationMin)}</td>
                      <td>{fmtEuro(o.totals.cost)}</td>
                      <td>{fmtKg(o.totals.co2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-canvas px-3 py-2.5 text-xs text-muted">
              <Info size={14} className="mt-0.5 shrink-0" />
              Estimations : itinéraires {result.sources.routing}, trafic {result.sources.traffic}, émissions {result.sources.co2}. Affluence des lieux : profils types
              modélisés.
            </p>
          </section>

          <button
            type="button"
            onClick={() => {
              trip.clearTrip();
              navigate('/planifier');
            }}
            className="btn w-full border border-red-100 bg-white !py-3 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 size={16} /> Effacer ce trajet maintenant
          </button>
        </div>
      </div>
    </div>
  );
}
