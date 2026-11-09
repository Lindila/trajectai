import { Router } from 'express';
import { z } from 'zod';
import { CATEGORIES, MODES, toMin } from '../lib/profiles.js';
import { routeGeometry, travelMatrix } from '../lib/routing.js';
import { departureTip, evaluate, explain, gainsBetween, makeTrafficFactor, optimize } from '../lib/optimizer.js';
import { getTraffic } from '../lib/opendata.js';
import { getDayForecast, isRainy, makeWeatherAt } from '../lib/weather.js';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const place = {
  label: z.string().trim().min(1).max(120),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
};

const schema = z.object({
  start: z.object(place),
  departure: z.string().regex(/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/),
  mode: z.enum(['car', 'transit', 'bike', 'walk']),
  priority: z.enum(['time', 'cost', 'co2']),
  returnToStart: z.boolean().default(true),
  stops: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        ...place,
        category: z.enum(Object.keys(CATEGORIES)).default('autre'),
        duration: z.number().int().min(0).max(480).optional(),
        // Liste de courses : seul le nombre d'articles influence le calcul.
        items: z.array(z.string().trim().min(1).max(60)).max(80).optional(),
        constraint: z
          .object({ type: z.enum(['none', 'before', 'after']), time: hhmm.optional() })
          .refine((c) => c.type === 'none' || c.time, 'Heure requise pour la contrainte')
          .optional(),
      }),
    )
    .min(2)
    .max(6),
  // Ordre imposé par l'usager (réorganisation manuelle) : il est évalué tel quel.
  order: z.array(z.string()).optional(),
});

export const optimizeRouter = Router();

optimizeRouter.post('/', async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Requête invalide', details: parsed.error.issues.map((i) => i.message) });
    }
    const input = parsed.data;
    const [date, time] = input.departure.split('T');
    const [y, m, d] = date.split('-').map(Number);
    const dayIndex = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lundi

    const [traffic, forecast] = await Promise.all([getTraffic(), getDayForecast(input.start.lat, input.start.lon, date)]);
    const weatherAt = makeWeatherAt(forecast);
    const trafficFactor = makeTrafficFactor(traffic);
    const points = [input.start, ...input.stops];
    const matrixModes = ['car', 'transit', 'bike', 'walk'];
    const matrices = Object.fromEntries(
      await Promise.all(matrixModes.map(async (mode) => [mode, await travelMatrix(points, mode)])),
    );

    const ctxFor = (mode) => ({
      stops: input.stops,
      matrix: matrices[mode],
      mode,
      priority: input.priority,
      dayIndex,
      departMin: toMin(time),
      returnToStart: input.returnToStart,
      trafficFactor,
      weatherAt,
      startLabel: input.start.label,
    });

    const ctx = ctxFor(input.mode);
    const inputOrder = input.stops.map((_, i) => i);
    const baseline = evaluate(inputOrder, ctx);
    const optimal = optimize(ctx);

    let plan = optimal;
    let manual = false;
    if (input.order?.length === input.stops.length) {
      const idx = input.order.map((id) => input.stops.findIndex((s) => s.id === id));
      if (idx.every((i) => i >= 0) && new Set(idx).size === idx.length) {
        plan = evaluate(idx, ctx);
        manual = true;
      }
    }
    explain(plan, ctx);

    const options = matrixModes.map((mode) => {
      const best = optimize(ctxFor(mode));
      return { mode, label: MODES[mode].label, order: best.order, totals: best.totals, feasible: best.feasible, score: best.score, rainExposedMin: best.rainExposedMin };
    });
    const feasibleOptions = options.filter((o) => o.feasible);
    const pool = feasibleOptions.length ? feasibleOptions : options;
    // En cas d'égalité (ex. vélo et marche à 0 €), on préfère un mode pas encore mis en avant.
    const used = new Set();
    const pick = (key) => {
      const min = Math.min(...pool.map((o) => o.totals[key]));
      const tied = pool.filter((o) => o.totals[key] - min < 0.01).sort((a, b) => a.totals.durationMin - b.totals.durationMin);
      const choice = tied.find((o) => !used.has(o.mode)) || tied[0];
      used.add(choice.mode);
      return choice.mode;
    };
    const tags = { fastest: pick('durationMin'), cheapest: pick('cost'), greenest: pick('co2') };

    // Météo sur la plage horaire de la journée, et mode recommandé (priorité + confort météo).
    let weather = null;
    if (forecast) {
      const from = Math.floor(toMin(time) / 60);
      const to = Math.min(23, Math.ceil(plan.totals.durationMin / 60) + from);
      const hours = forecast.hours.slice(from, to + 1);
      const rainy = hours.filter(isRainy);
      const temps = hours.map((h) => h.temp);
      const best = pool.reduce((a, b) => (b.score < a.score ? b : a));
      const exposedFastest = pool.filter((o) => ['bike', 'walk'].includes(o.mode)).sort((a, b) => a.totals.durationMin - b.totals.durationMin)[0];
      let reason;
      if (rainy.length && !['bike', 'walk'].includes(best.mode) && exposedFastest?.rainExposedMin > 0) {
        const peak = rainy.reduce((a, b) => (b.pop > a.pop ? b : a));
        reason = `Pluie prévue vers ${peak.h}h (${peak.pop} %) : ${best.label.toLowerCase()} vous garde au sec, plutôt que ${exposedFastest.label.toLowerCase()}.`;
      } else if (!rainy.length && ['bike', 'walk'].includes(best.mode)) {
        reason = `Temps sec (${Math.min(...temps)} à ${Math.max(...temps)} °C) : idéal pour le ${best.mode === 'bike' ? 'vélo' : 'trajet à pied'}, sans coût ni émissions.`;
      } else {
        reason = `${best.label} offre le meilleur équilibre pour votre priorité, compte tenu de la météo prévue.`;
      }
      weather = {
        source: forecast.source,
        summary: rainy.length ? `Pluie possible entre ${rainy[0].h}h et ${rainy[rainy.length - 1].h + 1}h` : hours.length ? `${hours[0].label}, pas de pluie prévue` : '',
        min: Math.min(...temps),
        max: Math.max(...temps),
        hours,
        recommended: { mode: best.mode, label: best.label, reason, isCurrent: best.mode === input.mode },
      };
    }

    const ordered = plan.order.map((id) => input.stops.find((s) => s.id === id));
    const geometry = await routeGeometry(
      [input.start, ...ordered, ...(input.returnToStart ? [input.start] : [])],
      input.mode === 'transit' ? 'car' : input.mode,
    );

    const gains = gainsBetween(plan, baseline);
    const summary = [];
    if (!manual && gains.minutes > 0) {
      summary.push(`Cet ordre vous fait gagner ${gains.minutes} min par rapport à l'ordre que vous avez saisi.`);
    }
    if (gains.queueMin > 0) summary.push(`Vous évitez environ ${gains.queueMin} min de file d'attente.`);
    if (gains.km > 0.2) summary.push(`${gains.km.toString().replace('.', ',')} km de moins grâce au regroupement des arrêts proches.`);
    if (manual) {
      const diff = plan.totals.durationMin - optimal.totals.durationMin;
      summary.push(
        diff > 0
          ? `Ordre personnalisé : ${diff} min de plus que l'ordre optimal, mais c'est vous qui décidez.`
          : 'Votre ordre personnalisé est aussi bon que l’ordre optimal.',
      );
    }
    if (!plan.feasible) summary.push("Certaines contraintes ne peuvent pas toutes être respectées : voir les alertes sur les étapes.");
    if (!summary.length) summary.push("Votre ordre était déjà le meilleur : nous l'avons conservé.");

    res.set('Cache-Control', 'no-store');
    res.json({
      mode: input.mode,
      priority: input.priority,
      manual,
      plan,
      baseline: { order: baseline.order, totals: baseline.totals },
      optimal: manual ? { order: optimal.order, totals: optimal.totals } : null,
      gains,
      summary,
      tip: departureTip(plan, ctx),
      options,
      tags,
      weather,
      geometry,
      sources: {
        routing: matrices[input.mode].source === 'osrm' ? 'OSRM / OpenStreetMap' : 'Estimation à vol d’oiseau (service de routage indisponible)',
        traffic: `${traffic.source} (${traffic.period?.from?.slice(0, 10)} → ${traffic.period?.to?.slice(0, 10)})`,
        co2: 'ADEME — Impact CO2',
        weather: forecast ? forecast.source : null,
      },
    });
  } catch (err) {
    next(err);
  }
});
