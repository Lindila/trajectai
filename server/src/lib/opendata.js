// Accès aux données ouvertes de la Ville de Paris (opendata.paris.fr, licence ODbL).
// Les agrégats sont calculés par l'API Opendatasoft, mis en cache en mémoire,
// avec un instantané local (server/data) en secours si l'API est indisponible.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const API = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets';
const DAY_MS = 24 * 3600 * 1000;

const cache = new Map();

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Open data HTTP ${res.status}`);
  return res.json();
}

async function cached(key, ttlMs, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  try {
    const value = await loader();
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch (err) {
    if (hit) return hit.value;
    const snapshot = JSON.parse(await readFile(path.join(DATA_DIR, `${key}.json`), 'utf8'));
    cache.set(key, { at: Date.now() - ttlMs + 10 * 60 * 1000, value: snapshot });
    return snapshot;
  }
}

// Comptages routiers permanents : débit moyen (q, véh/h) et taux d'occupation (k, %)
// agrégés par jour de semaine (1 = lundi) et par heure, heure de Paris.
export async function fetchTraffic() {
  const q = new URLSearchParams({
    select: 'avg(q) as q, avg(k) as k',
    group_by: 'date_format(t_1h,"e") as d, hour(t_1h) as h',
    limit: '200',
    timezone: 'Europe/Paris',
  });
  const range = new URLSearchParams({ select: 'min(t_1h) as a, max(t_1h) as b', timezone: 'Europe/Paris' });
  const [agg, span] = await Promise.all([
    getJson(`${API}/comptages-routiers-permanents/records?${q}`),
    getJson(`${API}/comptages-routiers-permanents/records?${range}`),
  ]);
  if (!agg.results || agg.results.length < 150) throw new Error('Agrégat trafic incomplet');
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ q: 0, k: 0 })));
  for (const r of agg.results) {
    grid[Number(r.d) - 1][r.h] = { q: Math.round(r.q), k: Math.round(r.k * 100) / 100 };
  }
  return {
    source: 'Ville de Paris — Comptages routiers permanents (capteurs de boucles électromagnétiques)',
    url: 'https://opendata.paris.fr/explore/dataset/comptages-routiers-permanents/',
    license: 'ODbL',
    period: { from: span.results?.[0]?.a, to: span.results?.[0]?.b },
    fetchedAt: new Date().toISOString(),
    days: grid,
  };
}

// Vélib' Métropole : disponibilité en temps réel, agrégée par arrondissement parisien.
// Dans Paris, le code station commence par le numéro d'arrondissement (ex. 11042 → 11e).
export async function fetchVelib() {
  const q = new URLSearchParams({
    select: 'stationcode, mechanical, ebike, numdocksavailable, capacity',
    where: 'is_installed="OUI" and code_insee_commune="75056"',
  });
  const stations = await getJson(`${API}/velib-disponibilite-en-temps-reel/exports/json?${q}`);
  const byArr = new Map();
  for (const s of stations) {
    const arr = Math.floor(Number(s.stationcode) / 1000);
    if (!(arr >= 1 && arr <= 20)) continue;
    const z = byArr.get(arr) || { arr, mechanical: 0, ebike: 0, docks: 0, capacity: 0, stations: 0 };
    z.mechanical += s.mechanical || 0;
    z.ebike += s.ebike || 0;
    z.docks += s.numdocksavailable || 0;
    z.capacity += s.capacity || 0;
    z.stations += 1;
    byArr.set(arr, z);
  }
  const zones = [...byArr.values()]
    .sort((a, b) => a.arr - b.arr)
    .map((z) => ({ ...z, zone: z.arr === 1 ? '1er' : `${z.arr}e` }));
  if (zones.length < 10) throw new Error('Données Vélib incomplètes');
  return {
    source: "Vélib' Métropole — Disponibilité en temps réel",
    url: 'https://opendata.paris.fr/explore/dataset/velib-disponibilite-en-temps-reel/',
    license: 'ODbL',
    fetchedAt: new Date().toISOString(),
    zones,
  };
}

export const getTraffic = () => cached('traffic', DAY_MS, fetchTraffic);
export const getVelib = () => cached('velib', 5 * 60 * 1000, fetchVelib);

export async function saveSnapshot(key, value) {
  await writeFile(path.join(DATA_DIR, `${key}.json`), JSON.stringify(value, null, 1));
}
