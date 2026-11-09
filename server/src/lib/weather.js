// Prévisions météo horaires (Open-Meteo, gratuit, sans clé, données Météo-France / ECMWF).
// Seules des coordonnées arrondies (~1 km) sont envoyées, et uniquement en cache mémoire 30 min.

const cache = new Map();
const TTL = 30 * 60 * 1000;

// Codes météo WMO → libellé court en français.
const WMO = [
  [[0], 'Ensoleillé', 'sun'],
  [[1, 2], 'Éclaircies', 'cloud-sun'],
  [[3], 'Couvert', 'cloud'],
  [[45, 48], 'Brouillard', 'fog'],
  [[51, 53, 55, 56, 57], 'Bruine', 'drizzle'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'Pluie', 'rain'],
  [[71, 73, 75, 77, 85, 86], 'Neige', 'snow'],
  [[95, 96, 99], 'Orage', 'storm'],
];
const describe = (code) => {
  const hit = WMO.find(([codes]) => codes.includes(code));
  return hit ? { label: hit[1], icon: hit[2] } : { label: 'Variable', icon: 'cloud' };
};

export async function getDayForecast(lat, lon, date) {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)},${date}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  const params = new URLSearchParams({
    latitude: lat.toFixed(2),
    longitude: lon.toFixed(2),
    hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m',
    timezone: 'Europe/Paris',
    start_date: date,
    end_date: date,
  });
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`météo HTTP ${res.status}`);
    const h = (await res.json()).hourly;
    const hours = h.time.map((_, i) => ({
      h: i,
      temp: Math.round(h.temperature_2m[i]),
      pop: h.precipitation_probability[i] ?? 0,
      precip: h.precipitation[i] ?? 0,
      wind: Math.round(h.wind_speed_10m[i] ?? 0),
      ...describe(h.weather_code[i]),
    }));
    const value = { source: 'Open-Meteo (Météo-France, ECMWF)', hours };
    cache.set(key, { at: Date.now(), value });
    return value;
  } catch {
    // Date hors de la fenêtre de prévision ou service indisponible : pas de météo.
    return null;
  }
}

export const isRainy = (w) => w && (w.precip >= 0.3 || w.pop >= 60 || ['rain', 'storm', 'snow'].includes(w.icon));

// Inconfort d'un trajet exposé (vélo, marche) : 0 = parfait, 1 = pluie franche.
export function exposure(w) {
  if (!w) return 0;
  let bad = 0;
  if (isRainy(w)) bad += 1;
  else if (w.pop >= 40 || w.icon === 'drizzle') bad += 0.4;
  if (w.temp <= 2 || w.temp >= 32) bad += 0.4;
  if (w.wind >= 40) bad += 0.4;
  return bad;
}

export function makeWeatherAt(forecast) {
  if (!forecast) return () => null;
  return (minute) => forecast.hours[Math.min(23, Math.max(0, Math.floor(minute / 60)))] || null;
}
