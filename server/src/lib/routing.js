// Temps et distances de trajet via OSRM (OpenStreetMap), avec repli sur une estimation
// à vol d'oiseau si le service public est indisponible. Aucune coordonnée n'est conservée.
import { MODES } from './profiles.js';

const UA = { 'User-Agent': 'TrajectAI/1.0 (projet etudiant EFREI DataCity)' };
const OSRM = {
  car: 'https://router.project-osrm.org/{svc}/v1/driving/',
  transit: 'https://router.project-osrm.org/{svc}/v1/driving/',
  bike: 'https://routing.openstreetmap.de/routed-bike/{svc}/v1/driving/',
  walk: 'https://routing.openstreetmap.de/routed-foot/{svc}/v1/driving/',
};

const coords = (points) => points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');

export function haversine(a, b) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function estimateMatrix(points, mode) {
  const speed = (MODES[mode].speedKmh * 1000) / 3600;
  const distances = points.map((a) => points.map((b) => haversine(a, b) * 1.35));
  const durations = distances.map((row) => row.map((d) => d / speed));
  return { distances, durations, source: 'estimation' };
}

// Renvoie des matrices en mètres et secondes (trafic fluide, hors attentes).
export async function travelMatrix(points, mode) {
  const url = `${OSRM[mode].replace('{svc}', 'table')}${coords(points)}?annotations=duration,distance`;
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    if (json.code !== 'Ok') throw new Error(json.code);
    const { distances } = json;
    let { durations } = json;
    if (mode === 'transit') {
      // Pas de calculateur transport en commun ouvert : distance routière / vitesse commerciale
      // moyenne + temps d'accès et d'attente en station.
      const speed = (MODES.transit.speedKmh * 1000) / 3600;
      durations = distances.map((row) => row.map((d) => (d === 0 ? 0 : d / speed + MODES.transit.accessMin * 60)));
    }
    return { distances, durations, source: 'osrm' };
  } catch {
    const est = estimateMatrix(points, mode);
    if (mode === 'transit') {
      est.durations = est.durations.map((row) => row.map((d) => (d === 0 ? 0 : d + MODES.transit.accessMin * 60)));
    }
    return est;
  }
}

// Tracé de l'itinéraire complet pour la carte : liste de [lat, lon].
export async function routeGeometry(points, mode) {
  const url = `${OSRM[mode].replace('{svc}', 'route')}${coords(points)}?overview=simplified&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    if (json.code !== 'Ok') throw new Error(json.code);
    return json.routes[0].geometry.coordinates.map(([lon, lat]) => [lat, lon]);
  } catch {
    return points.map((p) => [p.lat, p.lon]);
  }
}
