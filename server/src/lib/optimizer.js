// Moteur d'optimisation explicable de TrajectAI.
// Pour 2 à 6 étapes, toutes les permutations sont évaluées (au plus 720) : le résultat est
// exact, reproductible, et chaque choix peut être justifié par des chiffres.
import { CATEGORIES, CO2_KG_PER_KM, COST, MODES, fmtTime, hoursFor, toMin } from './profiles.js';
import { exposure, isRainy } from './weather.js';

export const PRIORITY_WEIGHTS = {
  // Poids appliqués à : minutes totales, euros, kg CO2e.
  time: { t: 1, c: 1, e: 1 },
  cost: { t: 0.15, c: 10, e: 1 },
  co2: { t: 0.15, c: 1, e: 40 },
};
const VIOLATION_WEIGHT = 50;
// Une minute à vélo ou à pied sous la pluie « coûte » 1,5 minute dans le score.
const WEATHER_WEIGHT = 1.5;

// Durée des courses estimée à partir de la liste : base + temps par article.
export const shoppingMinutes = (n) => Math.min(90, Math.round(6 + 1.3 * n));
const TRANSIT_WALK_BELOW_M = 700;

function permutations(items) {
  if (items.length <= 1) return [items];
  const out = [];
  items.forEach((item, i) => {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) out.push([item, ...rest]);
  });
  return out;
}

// Facteur de congestion dérivé du taux d'occupation réel des capteurs routiers parisiens.
export function makeTrafficFactor(traffic) {
  const all = traffic.days.flat().map((c) => c.k);
  const kMin = Math.min(...all);
  const kMax = Math.max(...all);
  return (dayIndex, minute, mode) => {
    const h = Math.floor(minute / 60) % 24;
    const d = (dayIndex + Math.floor(minute / 1440)) % 7;
    const norm = (traffic.days[d][h].k - kMin) / (kMax - kMin || 1);
    if (mode === 'car') return 1 + 0.6 * norm;
    if (mode === 'transit') return 1 + 0.15 * norm;
    return 1;
  };
}

function busyAt(category, minute) {
  return CATEGORIES[category].busy[Math.floor(minute / 60) % 24];
}

// Simule une journée dans un ordre donné. `order` contient des index de `stops`.
export function evaluate(order, ctx) {
  const { stops, matrix, mode, dayIndex, departMin, returnToStart, trafficFactor } = ctx;
  const weatherAt = ctx.weatherAt || (() => null);
  let weatherPenalty = 0;
  let rainExposedMin = 0;
  let t = departMin;
  let prev = 0; // index 0 = point de départ
  const steps = [];
  const totals = { travelMin: 0, queueMin: 0, waitMin: 0, km: 0, cost: 0, co2: 0 };
  let violation = 0;

  const leg = (from, to, at) => {
    const meters = matrix.distances[from][to];
    let seconds = matrix.durations[from][to];
    let legMode = mode;
    if (mode === 'transit' && meters < TRANSIT_WALK_BELOW_M) {
      legMode = 'walk';
      seconds = (meters * 1.1) / ((MODES.walk.speedKmh * 1000) / 3600);
    }
    const minutes = (seconds / 60) * trafficFactor(dayIndex, at, legMode);
    const km = meters / 1000;
    let cost = 0;
    let co2 = 0;
    if (legMode === 'car') {
      cost = km * COST.carPerKm;
      co2 = km * CO2_KG_PER_KM.car;
    } else if (legMode === 'transit' && meters > 0) {
      cost = COST.transitTicket;
      co2 = km * CO2_KG_PER_KM.transit;
    }
    let rainy = false;
    if ((legMode === 'bike' || legMode === 'walk') && minutes > 0) {
      const w = weatherAt(at + minutes / 2);
      const bad = exposure(w);
      weatherPenalty += minutes * bad * WEATHER_WEIGHT;
      if (isRainy(w)) {
        rainy = { pop: w.pop, label: w.label };
        rainExposedMin += minutes;
      }
    }
    return { minutes, km, cost, co2, legMode, rainy };
  };

  for (const idx of order) {
    const stop = stops[idx];
    const cat = CATEGORIES[stop.category] ? stop.category : 'autre';
    const def = CATEGORIES[cat];
    const l = leg(prev, idx + 1, t);
    let arrival = t + l.minutes;
    if (mode === 'car' && l.km > 0) arrival += MODES.car.parkingSearchMin;

    const hours = hoursFor(cat, (dayIndex + Math.floor(arrival / 1440)) % 7);
    let start = arrival;
    let waitReason = null;
    if (hours && !hours.closed && start < hours.open) {
      start = hours.open;
      waitReason = 'ouverture';
    }
    if (stop.constraint?.type === 'after') {
      const after = toMin(stop.constraint.time);
      if (start < after) {
        start = after;
        waitReason = 'contrainte';
      }
    }
    const wait = start - arrival;
    const items = stop.items?.length || 0;
    const duration = Number.isFinite(stop.duration) ? stop.duration : items ? shoppingMinutes(items) : def.duration;
    const busy = busyAt(cat, start);
    const queue = def.maxQueue * busy;

    let stepViolation = 0;
    const warnings = [];
    if (l.rainy) warnings.push(`Pluie probable pendant ce trajet ${l.legMode === 'bike' ? 'à vélo' : 'à pied'} (${l.rainy.pop} %).`);
    if (stop.constraint?.type === 'before') {
      const limit = toMin(stop.constraint.time);
      if (arrival > limit) {
        stepViolation += arrival - limit;
        warnings.push(`Arrivée prévue à ${fmtTime(arrival)}, après la limite de ${fmtTime(limit)}.`);
      }
    }
    if (hours?.closed) {
      stepViolation += 600;
      warnings.push(`${def.label} habituellement fermé(e) ce jour-là.`);
    } else if (hours && start + queue + duration > hours.close) {
      stepViolation += start + queue + duration - hours.close;
      warnings.push(`Risque de trouver porte close : fermeture habituelle à ${fmtTime(hours.close)}.`);
    }
    violation += stepViolation;

    const departure = start + queue + duration;
    if (mode === 'car' && cat !== 'travail') totals.cost += ((queue + duration) / 60) * COST.parkingPerHour;
    totals.travelMin += arrival - t;
    totals.queueMin += queue;
    totals.waitMin += wait;
    totals.km += l.km;
    totals.cost += l.cost;
    totals.co2 += l.co2;

    steps.push({
      id: stop.id,
      label: stop.label,
      category: cat,
      categoryLabel: def.label,
      lat: stop.lat,
      lon: stop.lon,
      constraint: stop.constraint?.type && stop.constraint.type !== 'none' ? stop.constraint : null,
      legMin: Math.round(arrival - t),
      legKm: Math.round(l.km * 10) / 10,
      legMode: l.legMode,
      arrivalMin: arrival,
      startMin: start,
      departMin: departure,
      arrival: fmtTime(arrival),
      start: fmtTime(start),
      departure: fmtTime(departure),
      waitMin: Math.round(wait),
      waitReason,
      queueMin: Math.round(queue),
      busyPct: Math.round(busy * 100),
      duration,
      items,
      weather: weatherAt(arrival),
      warnings,
      hours: hours && !hours.closed ? { open: fmtTime(hours.open), close: fmtTime(hours.close) } : null,
    });
    t = departure;
    prev = idx + 1;
  }

  let end = null;
  if (returnToStart) {
    const l = leg(prev, 0, t);
    const arrival = t + l.minutes;
    totals.travelMin += l.minutes;
    totals.km += l.km;
    totals.cost += l.cost;
    totals.co2 += l.co2;
    end = { arrivalMin: arrival, arrival: fmtTime(arrival), legMin: Math.round(l.minutes), legKm: Math.round(l.km * 10) / 10, rainy: Boolean(l.rainy) };
    t = arrival;
  }

  if (mode === 'transit') totals.cost = Math.min(totals.cost, COST.transitDayCap);

  const result = {
    order: order.map((i) => stops[i].id),
    steps,
    end,
    totals: {
      durationMin: Math.round(t - departMin),
      travelMin: Math.round(totals.travelMin),
      queueMin: Math.round(totals.queueMin),
      waitMin: Math.round(totals.waitMin),
      km: Math.round(totals.km * 10) / 10,
      cost: Math.round(totals.cost * 100) / 100,
      co2: Math.round(totals.co2 * 100) / 100,
      endTime: fmtTime(t),
    },
    violationMin: Math.round(violation),
    rainExposedMin: Math.round(rainExposedMin),
    feasible: violation < 1,
  };
  const w = PRIORITY_WEIGHTS[ctx.priority];
  result.score = w.t * (t - departMin) + w.c * totals.cost + w.e * totals.co2 + VIOLATION_WEIGHT * violation + weatherPenalty;
  return result;
}

export function optimize(ctx) {
  const indexes = ctx.stops.map((_, i) => i);
  let best = null;
  for (const order of permutations(indexes)) {
    const r = evaluate(order, ctx);
    if (!best || r.score < best.score - 1e-9) best = r;
  }
  return best;
}

// Explications en langage clair, une phrase principale par étape.
export function explain(plan, ctx) {
  const pct = (v) => `${Math.round(v * 100)} %`;
  plan.steps.forEach((step, i) => {
    const reasons = [];
    const def = CATEGORIES[step.category];
    const prev = i === 0 ? ctx.startLabel : plan.steps[i - 1].label;

    if (step.constraint?.type === 'before') {
      reasons.push(
        step.warnings.length
          ? `À atteindre avant ${step.constraint.time.replace(':', 'h')} : c'est au plus tôt possible avec ce départ.`
          : `À atteindre avant ${step.constraint.time.replace(':', 'h')} : placé en ${i + 1}${i === 0 ? 're' : 'e'} position, arrivée à ${step.arrival}.`,
      );
    }
    if (step.constraint?.type === 'after') {
      reasons.push(`Pas avant ${step.constraint.time.replace(':', 'h')}, comme vous l'avez demandé.`);
    }

    if (def.maxQueue > 0) {
      const hours = hoursFor(step.category, ctx.dayIndex);
      let peak = { busy: 0, h: null };
      for (let h = 7; h <= 20; h++) {
        const inside = !hours || hours.closed || (h * 60 >= hours.open && h * 60 < hours.close);
        if (inside && def.busy[h] > peak.busy) peak = { busy: def.busy[h], h };
      }
      const nowQueue = step.queueMin;
      const peakQueue = Math.round(def.maxQueue * peak.busy);
      if (peak.h !== null && peakQueue - nowQueue >= 4) {
        reasons.push(
          `${step.label} à ${step.start} : affluence estimée à ${pct(step.busyPct / 100)} contre ${pct(peak.busy)} vers ${peak.h}h, soit ~${peakQueue - nowQueue} min de file évitées.`,
        );
      } else if (step.busyPct >= 70) {
        reasons.push(`Créneau chargé (~${nowQueue} min d'attente), imposé par vos autres contraintes.`);
      }
    }

    if (step.items > 0) {
      reasons.push(`Liste de ${step.items} article${step.items > 1 ? 's' : ''} : environ ${step.duration} min de courses estimées.`);
    }
    if (step.waitReason === 'ouverture' && step.waitMin > 0) {
      reasons.push(`Ouverture à ${step.hours.open} : ${step.waitMin} min d'attente sur place.`);
    }
    if (i > 0 && step.legKm > 0 && step.legKm < 0.8) {
      reasons.push(`Enchaîné juste après ${prev} : seulement ${Math.round(step.legKm * 1000)} m à parcourir.`);
    }
    if (!reasons.length) {
      reasons.push(`Placé ici pour limiter les détours : ${step.legKm.toString().replace('.', ',')} km depuis ${prev}.`);
    }
    step.reasons = reasons;
    step.explanation = reasons[0];
  });
}

export function gainsBetween(plan, baseline) {
  return {
    minutes: baseline.totals.durationMin - plan.totals.durationMin,
    euros: Math.round((baseline.totals.cost - plan.totals.cost) * 100) / 100,
    co2: Math.round((baseline.totals.co2 - plan.totals.co2) * 100) / 100,
    queueMin: baseline.totals.queueMin - plan.totals.queueMin,
    km: Math.round((baseline.totals.km - plan.totals.km) * 10) / 10,
  };
}

// Conseil : un départ décalé de ±1 h ferait-il gagner du temps ?
export function departureTip(plan, ctx) {
  const indexes = plan.order.map((id) => ctx.stops.findIndex((s) => s.id === id));
  let best = { delta: 0, minutes: plan.totals.durationMin };
  for (const delta of [-60, -45, -30, -15, 15, 30, 45, 60]) {
    const r = evaluate(indexes, { ...ctx, departMin: ctx.departMin + delta });
    if (r.feasible && r.totals.durationMin < best.minutes) best = { delta, minutes: r.totals.durationMin };
  }
  const saved = plan.totals.durationMin - best.minutes;
  if (best.delta === 0 || saved < 5) return null;
  return {
    departure: fmtTime(ctx.departMin + best.delta),
    savedMin: saved,
    text: `Astuce : en partant à ${fmtTime(ctx.departMin + best.delta)}, votre journée durerait ${saved} min de moins (trafic et affluence plus faibles).`,
  };
}
