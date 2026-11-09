// « Où suis-je ? » : une image de la rue est analysée par un modèle de vision open source
// (Qwen via Groq) qui lit plaques, enseignes et monuments, puis le lieu est géocodé.
// L'image n'est ni stockée ni journalisée.
import { Router } from 'express';
import { z } from 'zod';
import { searchPlaces } from './geocode.js';

const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
const AI_API_KEY = process.env.AI_API_KEY || '';
const VISION_MODEL = process.env.AI_VISION_MODEL || 'qwen/qwen3.8-27b';

const schema = z.object({
  image: z.string().regex(/^data:image\/(jpeg|png|webp);base64,/).max(2_000_000),
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
});

const PROMPT = `Cette photo a été prise dans une rue, probablement à Paris ou en Île-de-France.
Repère tout ce qui permet de localiser l'endroit : plaques de rue (souvent bleues à Paris, avec l'arrondissement), numéros, enseignes de commerces, stations de métro, monuments.
Réponds UNIQUEMENT en JSON : {"query": "adresse ou lieu le plus précis possible à rechercher, avec la ville", "clues": ["indices lus, courts"], "confidence": nombre entre 0 et 1}.
Si rien n'est lisible, mets "query" à "" et "confidence" à 0. N'invente rien.`;

export const visionRouter = Router();

visionRouter.post('/locate', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Image invalide (JPEG, PNG ou WebP, 1,5 Mo maximum).' });
  if (!AI_API_KEY) return res.status(503).json({ error: "La reconnaissance d'image nécessite une clé d'IA côté serveur." });
  res.set('Cache-Control', 'no-store');
  const { image, lat, lon } = parsed.data;
  try {
    const r = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: VISION_MODEL,
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: image } }] }],
      }),
    });
    if (!r.ok) throw new Error(`vision HTTP ${r.status}`);
    const content = (await r.json()).choices?.[0]?.message?.content || '{}';
    let out;
    try {
      out = JSON.parse(content);
    } catch {
      out = { query: '', clues: [], confidence: 0 };
    }
    const query = String(out.query || '').slice(0, 120);
    const clues = (Array.isArray(out.clues) ? out.clues : []).map(String).slice(0, 6);
    const confidence = Math.max(0, Math.min(1, Number(out.confidence) || 0));
    if (!query) return res.json({ query: '', clues, confidence: 0, results: [] });
    const results = await searchPlaces(query, lat, lon);
    res.json({ query, clues, confidence, results: results.slice(0, 4) });
  } catch {
    res.status(502).json({ error: "L'analyse de l'image a échoué. Réessayez en visant une plaque de rue ou une enseigne." });
  }
});
