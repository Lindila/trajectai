// Paramètres du moteur d'optimisation. Chaque valeur est sourcée ou marquée comme hypothèse,
// pour que l'IA reste explicable jusque dans ses chiffres.

// Émissions en kg CO2e par km et par voyageur — ADEME, API Impact CO2 (impactco2.fr, 2025).
export const CO2_KG_PER_KM = {
  car: 0.1106, // Voiture thermique
  transit: 0.0042 * 0.7 + 0.1135 * 0.3, // Hypothèse : 70 % métro, 30 % bus thermique
  bike: 0, // Vélo mécanique
  walk: 0, // Marche
};

// Coûts (hypothèses documentées, Île-de-France 2025).
export const COST = {
  carPerKm: 0.16, // Carburant + usure, barème moyen citadine essence
  parkingPerHour: 4.0, // Stationnement résidentiel/visiteur Paris, moyenne arrondissements périphériques
  transitTicket: 2.5, // Ticket Métro-Train-RER (tarif unique IDFM 2025), un par trajet
  transitDayCap: 12.3, // Forfait Navigo Jour : au-delà, le forfait est moins cher que les tickets
};

export const MODES = {
  car: { label: 'Voiture', speedKmh: 22, parkingSearchMin: 5 },
  transit: { label: 'Transports en commun', speedKmh: 20, accessMin: 9 },
  bike: { label: 'Vélo', speedKmh: 15 },
  walk: { label: 'Marche', speedKmh: 4.8 },
};

// Catégories d'étapes : durée par défaut, horaires d'ouverture (lun-ven / sam / dim, null = fermé),
// file d'attente maximale observée en heure de pointe, et profil d'affluence horaire (0 → 1).
// Profils d'affluence : modélisés à partir des pics usuels (pause déjeuner, sortie de bureau),
// à remplacer par des données de fréquentation réelles lorsqu'elles sont ouvertes par la ville.
const P = (peaks) => {
  const curve = Array(24).fill(0.1);
  for (const [h, v] of Object.entries(peaks)) curve[h] = v;
  return curve;
};

export const CATEGORIES = {
  mairie: {
    label: 'Mairie',
    duration: 20,
    maxQueue: 35,
    hours: { week: ['08:30', '17:00'], sat: ['09:00', '12:30'], sun: null },
    busy: P({ 8: 0.45, 9: 0.55, 10: 0.6, 11: 0.75, 12: 0.95, 13: 0.9, 14: 0.5, 15: 0.3, 16: 0.45, 17: 0.5 }),
  },
  ecole: {
    label: 'École / crèche',
    duration: 8,
    maxQueue: 0,
    hours: { week: ['07:30', '18:30'], sat: null, sun: null },
    busy: P({}),
  },
  travail: {
    label: 'Travail',
    duration: 0,
    maxQueue: 0,
    hours: null,
    busy: P({}),
  },
  supermarche: {
    label: 'Supermarché',
    duration: 25,
    maxQueue: 15,
    hours: { week: ['08:30', '21:00'], sat: ['08:30', '21:00'], sun: ['09:00', '13:00'] },
    busy: P({ 9: 0.25, 10: 0.35, 11: 0.5, 12: 0.8, 13: 0.7, 14: 0.35, 15: 0.3, 16: 0.45, 17: 0.75, 18: 0.95, 19: 0.85, 20: 0.4 }),
  },
  relais: {
    label: 'Point relais / Poste',
    duration: 8,
    maxQueue: 20,
    hours: { week: ['09:00', '19:00'], sat: ['09:00', '13:00'], sun: null },
    busy: P({ 9: 0.3, 10: 0.35, 11: 0.5, 12: 0.9, 13: 0.85, 14: 0.4, 15: 0.3, 16: 0.4, 17: 0.8, 18: 0.95 }),
  },
  pharmacie: {
    label: 'Pharmacie',
    duration: 8,
    maxQueue: 12,
    hours: { week: ['09:00', '20:00'], sat: ['09:00', '19:00'], sun: null },
    busy: P({ 9: 0.4, 10: 0.45, 11: 0.5, 12: 0.7, 13: 0.5, 14: 0.35, 15: 0.3, 16: 0.4, 17: 0.7, 18: 0.85, 19: 0.6 }),
  },
  boulangerie: {
    label: 'Boulangerie',
    duration: 5,
    maxQueue: 10,
    hours: { week: ['07:00', '20:00'], sat: ['07:00', '20:00'], sun: ['07:00', '13:30'] },
    busy: P({ 7: 0.75, 8: 0.6, 9: 0.3, 10: 0.25, 11: 0.5, 12: 0.95, 13: 0.6, 16: 0.3, 17: 0.55, 18: 0.9, 19: 0.7 }),
  },
  banque: {
    label: 'Banque',
    duration: 20,
    maxQueue: 20,
    hours: { week: ['09:30', '17:30'], sat: ['09:30', '12:30'], sun: null },
    busy: P({ 9: 0.3, 10: 0.4, 11: 0.55, 12: 0.85, 13: 0.8, 14: 0.4, 15: 0.3, 16: 0.45, 17: 0.6 }),
  },
  medecin: {
    label: 'Médecin / santé',
    duration: 30,
    maxQueue: 0,
    hours: { week: ['08:00', '19:00'], sat: ['08:00', '12:00'], sun: null },
    busy: P({}),
  },
  sport: {
    label: 'Salle de sport',
    duration: 60,
    maxQueue: 12,
    hours: { week: ['06:30', '22:30'], sat: ['08:00', '20:00'], sun: ['08:00', '20:00'] },
    busy: P({ 7: 0.6, 8: 0.5, 12: 0.75, 13: 0.6, 17: 0.7, 18: 0.95, 19: 0.95, 20: 0.7 }),
  },
  autre: {
    label: 'Autre',
    duration: 15,
    maxQueue: 5,
    hours: null,
    busy: P({ 12: 0.6, 13: 0.5, 17: 0.6, 18: 0.7 }),
  },
};

export function hoursFor(category, dayIndex) {
  const h = CATEGORIES[category]?.hours;
  if (!h) return null;
  const slot = dayIndex === 6 ? h.sun : dayIndex === 5 ? h.sat : h.week;
  if (slot === null) return { closed: true };
  return { open: toMin(slot[0]), close: toMin(slot[1]) };
}

export const toMin = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const fmtTime = (min) => {
  const m = Math.round(min);
  const h = Math.floor(m / 60) % 24;
  return `${h}h${String(m % 60).padStart(2, '0')}`;
};
