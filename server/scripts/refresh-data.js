// Régénère les instantanés de secours (server/data/*.json) depuis opendata.paris.fr.
// Usage : npm run refresh-data
import { fetchTraffic, fetchVelib, saveSnapshot } from '../src/lib/opendata.js';

const traffic = await fetchTraffic();
await saveSnapshot('traffic', traffic);
console.log(`traffic.json : période ${traffic.period.from} → ${traffic.period.to}`);

const velib = await fetchVelib();
await saveSnapshot('velib', velib);
console.log(`velib.json : ${velib.zones.length} zones`);
