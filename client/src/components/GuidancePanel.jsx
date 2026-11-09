// Guidage vocal étape par étape avec détection d'arrivée.
// La position GPS n'est lue que si l'usager l'active, uniquement pendant le guidage,
// et n'est jamais transmise : la comparaison de distance se fait dans le navigateur.
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Flag, LocateFixed, Navigation, PartyPopper, Play, Square } from 'lucide-react';
import { speak } from '../lib/speech';
import { voiceOn } from '../lib/speech';
import { CATEGORIES, fmtDuration } from '../lib/constants';

const ARRIVAL_RADIUS_M = 80;

function distance(a, b) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const say = (text) => voiceOn() && speak(text);
const km = (v) => `${String(v).replace('.', ',')} kilomètre${v >= 2 ? 's' : ''}`;

export default function GuidancePanel({ result, guidance, arrive, stop, onPosition }) {
  const steps = result.plan.steps;
  const start = result.startPlace;
  const [gps, setGps] = useState(false);
  const [sim, setSim] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [distLeft, setDistLeft] = useState(null);
  const announced = useRef(-1);
  const arrivedFor = useRef(-1);

  const index = guidance.index;
  const isReturn = index >= steps.length;
  const target = isReturn ? { label: start.label, lat: start.lat, lon: start.lon, arrival: result.plan.end?.arrival } : steps[index];
  const from = index === 0 ? [start.lat, start.lon] : [steps[index - 1].lat, steps[index - 1].lon];

  // Annonces vocales à chaque changement d'étape.
  useEffect(() => {
    if (announced.current === index && !guidance.done) return;
    if (guidance.done) {
      if (announced.current !== 'done') {
        announced.current = 'done';
        const g = result.gains;
        say(
          `Vous êtes arrivé, votre journée est terminée ! ${
            g.minutes > 0 && !result.manual ? `Grâce à l'ordre optimisé, vous avez gagné environ ${g.minutes} minutes.` : ''
          } Votre trajet va maintenant être effacé si vous le souhaitez.`,
        );
      }
      return;
    }
    const prev = index > 0 ? steps[index - 1] : null;
    let text = '';
    if (index === 0) text = `C'est parti ! Première étape : ${target.label}, à ${km(target.legKm)}. Arrivée prévue à ${target.arrival}.`;
    else {
      text = `Vous êtes arrivé à ${prev.label}.`;
      if (prev.queueMin > 2) text += ` Prévoyez environ ${prev.queueMin} minutes d'attente.`;
      text += isReturn
        ? ` Ensuite, retour à ${start.label}, arrivée prévue à ${target.arrival}.`
        : ` Prochaine étape : ${target.label}, à ${km(target.legKm)}, arrivée prévue à ${target.arrival}.`;
    }
    announced.current = index;
    say(text);
  }, [index, guidance.done, isReturn, result, start.label, steps, target]);

  // Détection d'arrivée par GPS (local).
  useEffect(() => {
    if (!gps || guidance.done) return undefined;
    if (!navigator.geolocation) {
      setGpsError('Géolocalisation indisponible sur ce navigateur.');
      setGps(false);
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const here = [pos.coords.latitude, pos.coords.longitude];
        onPosition(here);
        const d = distance(here, [target.lat, target.lon]);
        setDistLeft(d);
        if (d < ARRIVAL_RADIUS_M && arrivedFor.current !== index) {
          arrivedFor.current = index;
          arrive();
        }
      },
      () => {
        setGpsError('Autorisez la localisation pour la détection automatique.');
        setGps(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [gps, guidance.done, index, target.lat, target.lon, arrive, onPosition]);

  // Simulation de démonstration : un point se déplace jusqu'à l'étape, puis l'arrivée est détectée.
  useEffect(() => {
    if (!sim || guidance.done) return undefined;
    let raf;
    let pause;
    const t0 = performance.now();
    const duration = 5000;
    const to = [target.lat, target.lon];
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const pos = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e];
      onPosition(pos);
      setDistLeft(distance(pos, to));
      if (p < 1) raf = requestAnimationFrame(tick);
      else pause = setTimeout(() => arrive(), 400);
    };
    // Laisse le temps à l'annonce vocale de commencer.
    const delay = setTimeout(() => (raf = requestAnimationFrame(tick)), 1800);
    return () => {
      clearTimeout(delay);
      clearTimeout(pause);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim, index, guidance.done]);

  useEffect(() => () => onPosition(null), [onPosition]);

  if (guidance.done) {
    return (
      <div className="card animate-fade-up overflow-hidden">
        <div className="flex items-center gap-4 bg-brand-500 px-5 py-5 text-white">
          <PartyPopper size={32} />
          <div>
            <p className="text-lg font-extrabold">Journée terminée !</p>
            <p className="text-sm text-white/85">
              {result.gains.minutes > 0 && !result.manual
                ? `${result.gains.minutes} min gagnées grâce à l'ordre optimisé.`
                : 'Toutes les étapes sont faites.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 p-4">
          <button type="button" onClick={stop} className="btn-ghost flex-1">
            Fermer le guidage
          </button>
        </div>
      </div>
    );
  }

  const cat = isReturn ? null : CATEGORIES[target.category] || CATEGORIES.autre;
  const Icon = cat?.icon || Flag;

  return (
    <div className="card animate-fade-up overflow-hidden border-brand-400">
      <div className="flex items-center gap-4 bg-ink px-5 py-4 text-white">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: cat?.color || '#1aa86c' }}>
          <Icon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wider text-white/60 uppercase">
            {isReturn ? 'Retour' : `Étape ${index + 1} sur ${steps.length}`}
          </p>
          <p className="truncate text-lg font-extrabold">{target.label}</p>
          <p className="text-sm text-white/75">
            Arrivée prévue {target.arrival}
            {distLeft != null && ` · encore ${distLeft > 1000 ? `${(distLeft / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(distLeft)} m`}`}
          </p>
        </div>
        <Navigation size={22} className="shrink-0 text-brand-400" />
      </div>

      {!isReturn && target.explanation && <p className="border-b border-line px-5 py-3 text-sm text-muted">{target.explanation}</p>}

      <div className="grid gap-2 p-4 sm:grid-cols-2">
        <button type="button" onClick={() => arrive()} className="btn-brand sm:col-span-2">
          <CheckCircle2 size={19} /> Je suis arrivé{isReturn ? ' (fin)' : ''}
        </button>
        <button
          type="button"
          onClick={() => {
            setGpsError(null);
            setSim(false);
            setGps((g) => !g);
          }}
          className={`btn !py-2.5 text-sm ${gps ? 'bg-blue-600 text-white' : 'btn-ghost'}`}
          aria-pressed={gps}
        >
          <LocateFixed size={17} /> {gps ? 'Détection GPS active' : 'Détection auto (GPS)'}
        </button>
        <button
          type="button"
          onClick={() => {
            setGps(false);
            setSim((s) => !s);
          }}
          className={`btn !py-2.5 text-sm ${sim ? 'bg-cheap-500 text-white' : 'btn-ghost'}`}
          aria-pressed={sim}
        >
          <Play size={17} /> {sim ? 'Simulation en cours' : 'Simuler le trajet (démo)'}
        </button>
      </div>
      {gpsError && <p className="px-5 pb-3 text-xs text-red-600">{gpsError}</p>}
      <div className="flex items-center justify-between border-t border-line px-5 py-3 text-xs text-muted">
        <span>Position traitée uniquement sur votre appareil · {fmtDuration(result.plan.totals.durationMin)} au total</span>
        <button type="button" onClick={stop} className="inline-flex items-center gap-1 font-semibold text-red-600 hover:underline">
          <Square size={12} /> Arrêter
        </button>
      </div>
    </div>
  );
}
