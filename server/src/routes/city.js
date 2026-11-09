import { Router } from 'express';
import { getTraffic, getVelib } from '../lib/opendata.js';
import { CO2_KG_PER_KM } from '../lib/profiles.js';

export const cityRouter = Router();

cityRouter.get('/traffic', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json(await getTraffic());
  } catch (err) {
    next(err);
  }
});

cityRouter.get('/velib', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=120');
    res.json(await getVelib());
  } catch (err) {
    next(err);
  }
});

// Facteurs d'émission ADEME (kg CO2e / km / voyageur), API Impact CO2.
cityRouter.get('/co2', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json({
    source: 'ADEME — Impact CO2 (impactco2.fr)',
    url: 'https://impactco2.fr/outils/transport',
    modes: [
      { id: 'car', label: 'Voiture thermique', kgPerKm: CO2_KG_PER_KM.car },
      { id: 'ev', label: 'Voiture électrique', kgPerKm: 0.0121 },
      { id: 'bus', label: 'Bus thermique', kgPerKm: 0.1135 },
      { id: 'scooter', label: 'Scooter thermique', kgPerKm: 0.0604 },
      { id: 'rer', label: 'RER / Transilien', kgPerKm: 0.0066 },
      { id: 'metro', label: 'Métro', kgPerKm: 0.0042 },
      { id: 'tram', label: 'Tramway', kgPerKm: 0.0038 },
      { id: 'vae', label: 'Vélo électrique', kgPerKm: 0.0022 },
      { id: 'bike', label: 'Vélo', kgPerKm: 0 },
      { id: 'walk', label: 'Marche', kgPerKm: 0 },
    ],
  });
});
