// « Mémoire de l'appareil » : historique des trajets et adresses récentes.
// Désactivée par défaut, activée par l'usager, stockée UNIQUEMENT dans ce navigateur
// (jamais envoyée au serveur) et effaçable à tout moment.
const KEY_ON = 'trajectai-memory';
const KEY_PLACES = 'trajectai-recent-places';
const KEY_TRIPS = 'trajectai-trips';
const MAX_PLACES = 8;
const MAX_TRIPS = 20;

const read = (k, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* stockage indisponible (navigation privée) : on ignore */
  }
};
const notify = () => window.dispatchEvent(new Event('traject:memory'));

export const memoryOn = () => read(KEY_ON, false) === true;

export function setMemoryOn(on) {
  write(KEY_ON, on);
  if (!on) {
    try {
      localStorage.removeItem(KEY_PLACES);
      localStorage.removeItem(KEY_TRIPS);
    } catch {
      /* ignore */
    }
  }
  notify();
}

export function clearMemory() {
  try {
    localStorage.removeItem(KEY_PLACES);
    localStorage.removeItem(KEY_TRIPS);
  } catch {
    /* ignore */
  }
  notify();
}

// ---------- Adresses récentes ----------
export const recentPlaces = () => (memoryOn() ? read(KEY_PLACES, []) : []);

export function rememberPlace(p) {
  if (!memoryOn() || !p?.label || !Number.isFinite(p.lat)) return;
  const place = { label: p.label, sub: p.sub || '', lat: p.lat, lon: p.lon, category: p.category || 'autre' };
  const list = read(KEY_PLACES, []).filter((x) => !(x.label === place.label && Math.abs(x.lat - place.lat) < 1e-4));
  write(KEY_PLACES, [place, ...list].slice(0, MAX_PLACES));
  notify();
}

// ---------- Historique des trajets ----------
export const savedTrips = () => (memoryOn() ? read(KEY_TRIPS, []) : []);

const signature = (t) => [t.start?.label, ...t.stops.map((s) => `${s.label}|${s.lat.toFixed(4)}`).sort()].join('§');

export function saveTrip(form, result) {
  if (!memoryOn()) return;
  const entry = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    savedAt: new Date().toISOString(),
    date: form.date,
    time: form.time,
    mode: result.mode,
    priority: result.priority,
    returnToStart: form.returnToStart,
    start: form.start,
    stops: form.stops.map(({ label, sub, lat, lon, category, constraint, duration, items }) => ({ label, sub, lat, lon, category, constraint, duration, items })),
    order: result.plan.steps.map((s) => s.label),
    totals: result.plan.totals,
    gains: result.gains,
    favorite: false,
  };
  const list = read(KEY_TRIPS, []);
  // Un recalcul (changement de priorité, de mode…) met à jour le dernier trajet au lieu d'en créer un nouveau.
  const same = list.findIndex((t) => signature(t) === signature(entry));
  if (same >= 0) {
    entry.favorite = list[same].favorite;
    list.splice(same, 1);
  }
  write(KEY_TRIPS, [entry, ...list].slice(0, MAX_TRIPS));
  notify();
}

export function updateTrip(id, patch) {
  write(KEY_TRIPS, read(KEY_TRIPS, []).map((t) => (t.id === id ? { ...t, ...patch } : t)));
  notify();
}

export function removeTrip(id) {
  write(KEY_TRIPS, read(KEY_TRIPS, []).filter((t) => t.id !== id));
  notify();
}
