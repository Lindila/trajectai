import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate, explain, makeTrafficFactor, optimize, shoppingMinutes } from '../src/lib/optimizer.js';
import { haversine } from '../src/lib/routing.js';

const traffic = JSON.parse(readFileSync(new URL('../data/traffic.json', import.meta.url)));
const start = { label: 'Domicile', lat: 48.8534, lon: 2.381 };
const stops = [
  { id: 'mairie', label: 'Mairie', lat: 48.8587, lon: 2.379, category: 'mairie' },
  { id: 'super', label: 'Supermarché', lat: 48.857, lon: 2.37, category: 'supermarche' },
  { id: 'ecole', label: 'École', lat: 48.8555, lon: 2.376, category: 'ecole', constraint: { type: 'before', time: '08:30' } },
];

// Matrice hors ligne : distance à vol d'oiseau, 15 km/h.
function matrixFor(points) {
  const distances = points.map((a) => points.map((b) => haversine(a, b) * 1.3));
  return { distances, durations: distances.map((r) => r.map((d) => d / (15000 / 3600))) };
}

const ctx = (over = {}) => ({
  stops,
  matrix: matrixFor([start, ...stops]),
  mode: 'bike',
  priority: 'time',
  dayIndex: 2,
  departMin: 8 * 60,
  returnToStart: true,
  trafficFactor: makeTrafficFactor(traffic),
  startLabel: start.label,
  ...over,
});

test("respecte la contrainte « école avant 8h30 »", () => {
  const best = optimize(ctx());
  assert.equal(best.order[0], 'ecole');
  assert.ok(best.feasible);
});

test("l'ordre optimal n'est jamais pire que l'ordre saisi", () => {
  const c = ctx();
  const baseline = evaluate([0, 1, 2], c);
  const best = optimize(c);
  assert.ok(best.score <= baseline.score);
});

test('signale une contrainte impossible', () => {
  const r = evaluate([0, 1, 2], ctx({ departMin: 9 * 60 }));
  assert.equal(r.feasible, false);
  assert.ok(r.steps.find((s) => s.id === 'ecole').warnings.length > 0);
});

test('une mairie fermée le dimanche est pénalisée', () => {
  const r = evaluate([2, 0, 1], ctx({ dayIndex: 6 }));
  assert.ok(r.steps.find((s) => s.id === 'mairie').warnings.some((w) => /fermé/.test(w)));
});

test('chaque étape reçoit une explication', () => {
  const c = ctx();
  const best = optimize(c);
  explain(best, c);
  for (const s of best.steps) assert.ok(s.explanation && s.explanation.length > 10);
});

test('le trafic réel ralentit la voiture en heure de pointe', () => {
  const f = makeTrafficFactor(traffic);
  assert.ok(f(1, 18 * 60, 'car') > f(1, 4 * 60, 'car'));
  assert.equal(f(1, 18 * 60, 'bike'), 1);
});

test('la pluie pénalise le vélo mais pas la voiture', () => {
  const rain = () => ({ temp: 12, pop: 90, precip: 2, wind: 10, icon: 'rain', label: 'Pluie' });
  const dry = () => ({ temp: 18, pop: 0, precip: 0, wind: 5, icon: 'sun', label: 'Ensoleillé' });
  const bikeRain = evaluate([2, 0, 1], ctx({ weatherAt: rain }));
  const bikeDry = evaluate([2, 0, 1], ctx({ weatherAt: dry }));
  assert.ok(bikeRain.score > bikeDry.score);
  assert.ok(bikeRain.rainExposedMin > 0);
  assert.ok(bikeRain.steps.some((s) => s.warnings.some((w) => /Pluie/.test(w))));
  const carRain = evaluate([2, 0, 1], ctx({ mode: 'car', weatherAt: rain }));
  const carDry = evaluate([2, 0, 1], ctx({ mode: 'car', weatherAt: dry }));
  assert.equal(carRain.score, carDry.score);
});

test('la liste de courses allonge le temps au supermarché', () => {
  const items = Array.from({ length: 20 }, (_, i) => `article ${i}`);
  const withList = { ...ctx(), stops: stops.map((s) => (s.id === 'super' ? { ...s, items } : s)) };
  const r = evaluate([2, 0, 1], withList);
  const step = r.steps.find((s) => s.id === 'super');
  assert.equal(step.items, 20);
  assert.equal(step.duration, shoppingMinutes(20));
  explain(r, withList);
  assert.ok(step.reasons.some((x) => /20 articles/.test(x)));
});
