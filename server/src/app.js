import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { optimizeRouter } from './routes/optimize.js';
import { geocodeRouter } from './routes/geocode.js';
import { cityRouter } from './routes/city.js';
import { assistantRouter } from './routes/assistant.js';
import { visionRouter } from './routes/vision.js';

const app = express();
const origins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((o) => o.trim());

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: origins }));
// Les photos de la fonction « Où suis-je ? » ont besoin d'une limite plus large, sur cette seule route.
app.use('/api/vision', express.json({ limit: '2mb' }));
app.use(express.json({ limit: '50kb' }));

// Zéro historique : aucun journal de requêtes, aucun corps de requête n'est écrit sur disque.
const limiter = (max) => rateLimit({ windowMs: 60 * 1000, max, standardHeaders: 'draft-7', legacyHeaders: false });

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/optimize', limiter(40), optimizeRouter);
app.use('/api/geocode', limiter(120), geocodeRouter);
app.use('/api/city', limiter(60), cityRouter);
app.use('/api/assistant', limiter(20), assistantRouter);
app.use('/api/vision', limiter(10), visionRouter);

app.use((_req, res) => res.status(404).json({ error: 'Route inconnue' }));
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Erreur interne, réessayez dans un instant.' });
});

export default app;
