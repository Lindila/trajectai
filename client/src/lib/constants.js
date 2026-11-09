import {
  Banknote,
  Bike,
  Briefcase,
  Bus,
  Car,
  Croissant,
  Dumbbell,
  Euro,
  Footprints,
  Landmark,
  Leaf,
  MapPin,
  Package,
  Pill,
  School,
  ShoppingCart,
  Stethoscope,
  Zap,
} from 'lucide-react';

export const CATEGORIES = {
  mairie: { label: 'Mairie', icon: Landmark, color: '#7c5cf0' },
  ecole: { label: 'École / crèche', icon: School, color: '#e0508f' },
  travail: { label: 'Travail', icon: Briefcase, color: '#475569' },
  supermarche: { label: 'Supermarché', icon: ShoppingCart, color: '#16a34a' },
  relais: { label: 'Point relais / Poste', icon: Package, color: '#f59e0b' },
  pharmacie: { label: 'Pharmacie', icon: Pill, color: '#0d9488' },
  boulangerie: { label: 'Boulangerie', icon: Croissant, color: '#c2710c' },
  banque: { label: 'Banque', icon: Banknote, color: '#4f46e5' },
  medecin: { label: 'Médecin / santé', icon: Stethoscope, color: '#dc2626' },
  sport: { label: 'Salle de sport', icon: Dumbbell, color: '#2a78d6' },
  autre: { label: 'Autre', icon: MapPin, color: '#64748b' },
};

export const MODES = {
  car: { label: 'Voiture', short: 'Voiture', icon: Car },
  transit: { label: 'Transports en commun', short: 'Transports', icon: Bus },
  bike: { label: 'Vélo', short: 'Vélo', icon: Bike },
  walk: { label: 'Marche', short: 'À pied', icon: Footprints },
};

export const PRIORITIES = {
  time: { label: 'Gagner du temps', short: 'Plus rapide', icon: Zap, tone: 'brand' },
  cost: { label: 'Dépenser moins', short: 'Moins cher', icon: Euro, tone: 'cheap' },
  co2: { label: 'Polluer moins', short: 'Moins polluant', icon: Leaf, tone: 'eco' },
};

// Même formule que le serveur : temps de base + temps par article.
export const shoppingMinutes = (n) => Math.min(90, Math.round(6 + 1.3 * n));

export const fmtDuration = (min) => {
  if (min == null) return '—';
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};
export const fmtEuro = (v) => `${Number(v).toFixed(2).replace('.', ',')} €`;
export const fmtKg = (v) => `${Number(v).toFixed(1).replace('.', ',')} kg`;
export const fmtNum = (v) => new Intl.NumberFormat('fr-FR').format(v);

// Journée d'exemple pour la démonstration (Paris 11e).
export const DEMO_DAY = {
  start: { label: 'Domicile — Rue de la Roquette', lat: 48.8534, lon: 2.381 },
  stops: [
    { label: 'Mairie du 11e arrondissement', sub: 'Place Léon Blum, 75011 Paris', lat: 48.8587, lon: 2.379, category: 'mairie' },
    { label: 'Monoprix Voltaire', sub: 'Boulevard Voltaire, 75011 Paris', lat: 48.857, lon: 2.37, category: 'supermarche' },
    { label: 'École Keller', sub: 'Rue Keller, 75011 Paris', lat: 48.8555, lon: 2.376, category: 'ecole', constraint: { type: 'before', time: '08:30' } },
    { label: 'Point relais Oberkampf', sub: 'Rue Oberkampf, 75011 Paris', lat: 48.861, lon: 2.368, category: 'relais' },
    { label: 'Salle de sport Nation', sub: 'Boulevard de Charonne, 75011 Paris', lat: 48.848, lon: 2.395, category: 'sport' },
  ],
  time: '08:00',
};
