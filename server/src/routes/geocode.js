// Recherche de lieux (Photon / OpenStreetMap, repli sur la Base Adresse Nationale).
// La requête est relayée sans être journalisée.
import { Router } from 'express';
import { haversine } from '../lib/routing.js';

const UA = { 'User-Agent': 'TrajectAI/1.0 (projet etudiant EFREI DataCity)' };
const PARIS = { lat: 48.8566, lon: 2.3522 };
const IDF_BBOX = '1.44,48.12,3.56,49.24';

const OSM_CATEGORY = {
  townhall: 'mairie',
  school: 'ecole',
  kindergarten: 'ecole',
  childcare: 'ecole',
  college: 'ecole',
  supermarket: 'supermarche',
  convenience: 'supermarche',
  greengrocer: 'supermarche',
  post_office: 'relais',
  parcel_locker: 'relais',
  pharmacy: 'pharmacie',
  bakery: 'boulangerie',
  pastry: 'boulangerie',
  bank: 'banque',
  doctors: 'medecin',
  clinic: 'medecin',
  hospital: 'medecin',
  dentist: 'medecin',
  fitness_centre: 'sport',
  sports_centre: 'sport',
  swimming_pool: 'sport',
  office: 'travail',
  company: 'travail',
};

function guessCategory(props) {
  const direct = OSM_CATEGORY[props.osm_value];
  if (direct) return direct;
  const name = (props.name || '').toLowerCase();
  if (/mairie|h[ôo]tel de ville/.test(name)) return 'mairie';
  if (/[ée]cole|cr[èe]che|coll[èe]ge|lyc[ée]e/.test(name)) return 'ecole';
  if (/relais|la poste|bureau de poste|pickup|mondial/.test(name)) return 'relais';
  if (/carrefour|monoprix|franprix|leclerc|lidl|auchan|intermarch|super ?u|casino|picard/.test(name)) return 'supermarche';
  if (/basic.?fit|fitness|salle de sport|gym|keep cool|neoness|on air/.test(name)) return 'sport';
  if (/pharmacie/.test(name)) return 'pharmacie';
  if (/boulangerie/.test(name)) return 'boulangerie';
  return 'autre';
}

function photonLabel(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(' ');
  const title = p.name || street || p.city;
  const sub = [p.name ? street : null, p.postcode, p.city].filter(Boolean).join(' ');
  return { title, sub };
}

export const geocodeRouter = Router();

// Requête générique (« pharmacie », « une boulangerie ») : on veut le lieu le plus proche, pas le plus connu.
const GENERIC = /^(la |le |l'|une? |des )?(pharmacie|boulangerie|supermarch[ée]|superette|sup[ée]rette|monoprix|franprix|carrefour|poste|bureau de poste|point relais|relais colis|banque|distributeur|mairie|[ée]cole|cr[èe]che|m[ée]decin|docteur|salle de sport|parc|caf[ée]|restaurant|station[- ]service|parking|v[ée]lib)s?$/i;

// Recherche partagée (autocomplétion et vision). Avec une position, les lieux proches passent en premier.
export async function searchPlaces(q, lat, lon) {
  const near = Number.isFinite(lat) && Number.isFinite(lon);
  const center = near ? { lat, lon } : PARIS;
  const withDistance = (r) => (near ? { ...r, distanceM: Math.round(haversine({ lat, lon }, r)) } : r);
  try {
    const generic = near && GENERIC.test(q.trim());
    const params = new URLSearchParams({ q, lang: 'fr', limit: generic ? '12' : '6', lat: center.lat, lon: center.lon, bbox: IDF_BBOX });
    if (near) {
      params.set('location_bias_scale', '0');
      params.set('zoom', '16');
    }
    const r = await fetch(`https://photon.komoot.io/api/?${params}`, { headers: UA, signal: AbortSignal.timeout(6000) });
    const json = await r.json();
    const results = json.features.map((f) => {
      const { title, sub } = photonLabel(f.properties);
      return withDistance({ label: title, sub, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], category: guessCategory(f.properties) });
    });
    if (generic) results.sort((a, b) => a.distanceM - b.distanceM);
    // Une même rue apparaît en plusieurs tronçons dans OpenStreetMap : on garde le plus proche.
    const seen = new Set();
    const unique = results.filter((r) => {
      const key = `${r.label}|${r.sub}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length) return unique.slice(0, 6);
    throw new Error('Aucun résultat Photon');
  } catch {
    const params = new URLSearchParams({ q, limit: '6', lat: center.lat, lon: center.lon });
    const r = await fetch(`https://api-adresse.data.gouv.fr/search/?${params}`, { signal: AbortSignal.timeout(6000) });
    const json = await r.json();
    return json.features.map((f) =>
      withDistance({ label: f.properties.name, sub: `${f.properties.postcode} ${f.properties.city}`, lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], category: 'autre' }),
    );
  }
}

geocodeRouter.get('/', async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 120);
  if (q.length < 3) return res.json({ results: [] });
  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lon = req.query.lon ? Number(req.query.lon) : undefined;
  res.set('Cache-Control', 'no-store');
  try {
    res.json({ results: await searchPlaces(q, lat, lon) });
  } catch {
    res.status(502).json({ error: 'Service de recherche indisponible', results: [] });
  }
});

geocodeRouter.get('/reverse', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({ error: 'Coordonnées invalides' });
  res.set('Cache-Control', 'no-store');
  try {
    const r = await fetch(`https://api-adresse.data.gouv.fr/reverse/?lat=${lat}&lon=${lon}`, { signal: AbortSignal.timeout(6000) });
    const json = await r.json();
    const f = json.features?.[0];
    res.json({ label: f ? f.properties.label : 'Ma position', lat, lon });
  } catch {
    res.json({ label: 'Ma position', lat, lon });
  }
});
