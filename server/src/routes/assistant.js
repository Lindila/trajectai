// Assistant conversationnel « Traject ».
// Fournisseur compatible OpenAI configurable : Groq (GPT-OSS 120B, open source, gratuit) par défaut,
// Ollama en local, OpenRouter… Sans clé, un moteur de règles local prend le relais.
// Les messages ne sont ni journalisés ni conservés.
import { Router } from 'express';
import { z } from 'zod';
import { getTraffic } from '../lib/opendata.js';

const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
const AI_MODEL = process.env.AI_MODEL || 'openai/gpt-oss-120b';
const AI_API_KEY = process.env.AI_API_KEY || '';
const aiEnabled = () => Boolean(AI_API_KEY) || AI_BASE_URL.includes('localhost') || AI_BASE_URL.includes('127.0.0.1');

const ACTIONS = ['none', 'setPriority', 'setMode', 'optimize', 'startGuidance', 'nextStep', 'openPage', 'addStops'];
const CATEGORY_IDS = ['mairie', 'ecole', 'travail', 'supermarche', 'relais', 'pharmacie', 'boulangerie', 'banque', 'medecin', 'sport', 'autre'];

// « 17h », « 17h30 », « 9:05 » → « 17:00 », « 17:30 », « 09:05 ».
function normTime(raw) {
  const m = String(raw || '').trim().match(/^(\d{1,2})\s*[h:]\s*(\d{2})?$/i);
  if (!m || Number(m[1]) > 23 || Number(m[2] || 0) > 59) return null;
  return `${m[1].padStart(2, '0')}:${m[2] || '00'}`;
}
function normConstraint(c) {
  const time = normTime(c?.time);
  return ['before', 'after'].includes(c?.type) && time ? { type: c.type, time } : { type: 'none' };
}

// Étapes dictées : on ne garde que des champs simples et bornés.
function cleanStops(value) {
  if (!Array.isArray(value)) return null;
  const stops = value.slice(0, 6).map((v) => ({
    query: String(v?.query || '').trim().slice(0, 100),
    category: CATEGORY_IDS.includes(v?.category) ? v.category : 'autre',
    constraint: normConstraint(v?.constraint),
    items: Array.isArray(v?.items) ? v.items.map((i) => String(i).slice(0, 60)).slice(0, 80) : undefined,
  })).filter((v) => v.query);
  return stops.length ? stops : null;
}

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) }))
    .min(1)
    .max(20),
  context: z
    .object({
      page: z.string().max(40).optional(),
      plan: z.any().optional(),
      guidance: z.any().optional(),
      draft: z.any().optional(),
      weather: z.any().optional(),
    })
    .optional(),
});

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

async function trafficDigest() {
  const t = await getTraffic();
  return t.days
    .map((hours, d) => {
      const ranked = hours.map((c, h) => ({ h, k: c.k })).filter((x) => x.h >= 7 && x.h <= 21);
      ranked.sort((a, b) => b.k - a.k);
      const calm = [...ranked].reverse();
      return `${DAYS[d]} : plus chargé vers ${ranked[0].h}h et ${ranked[1].h}h, plus calme vers ${calm[0].h}h`;
    })
    .join(' ; ');
}

function planDigest(plan) {
  if (!plan?.steps?.length) return "Aucun trajet n'est calculé pour le moment.";
  const steps = plan.steps
    .map((s, i) => `${i + 1}. ${s.label} (${s.categoryLabel}) — arrivée ${s.arrival}, attente estimée ${s.queueMin} min. Raison : ${s.explanation}`)
    .join('\n');
  const t = plan.totals || {};
  return `Mode : ${plan.modeLabel || plan.mode}. Priorité : ${plan.priorityLabel || plan.priority}.
Étapes dans l'ordre :
${steps}
Retour prévu : ${plan.endTime || t.endTime}. Durée totale ${t.durationMin} min, ${t.km} km, coût ${t.cost} €, ${t.co2} kg CO2.
Résumé : ${(plan.summary || []).join(' ')}`;
}

function systemPrompt(context, traffic) {
  const g = context?.guidance;
  return `Tu es Traject, l'assistant vocal de TrajectAI, une application citoyenne (projet DataCity EFREI, thème MOVECITY) qui optimise l'ordre des trajets multi-étapes des actifs et des parents à Paris.
Principe : le citoyen liste, l'IA optimise, la ville informe, l'usager contrôle.
Réponds TOUJOURS en français, de façon chaleureuse, claire et COURTE (2 à 3 phrases, elles seront lues à voix haute). Pas de markdown, pas de listes à puces, pas d'emoji.
N'invente jamais d'horaire ni de chiffre : utilise uniquement le contexte ci-dessous. Si tu ne sais pas, dis-le.
Confidentialité : TrajectAI ne conserve aucun trajet sur ses serveurs (l'usager peut activer un historique stocké uniquement sur son propre appareil), n'utilise pas de géolocalisation en continu (seulement pendant le guidage si l'usager l'active, et uniquement dans son navigateur). Le compte ne stocke que l'email, le mot de passe haché et les préférences.
Méthode : l'algorithme teste tous les ordres possibles et choisit le meilleur selon la priorité (temps, coût ou CO2), en croisant temps de trajet OpenStreetMap, taux d'occupation réel des routes parisiennes (open data Ville de Paris), affluence type des lieux et horaires d'ouverture. Émissions : ADEME.
Page actuelle : ${context?.page || 'inconnue'}.
Trajet actuel :
${planDigest(context?.plan)}
${g ? `Guidage en cours : étape ${g.index + 1} sur ${g.total}, prochaine destination ${g.next || 'retour'}.` : ''}
${context?.draft ? `Journée en préparation (pas encore optimisée) : départ ${context.draft.start || 'non renseigné'}, étapes : ${(context.draft.stops || []).join(', ') || 'aucune'}.` : ''}
${context?.weather ? `Météo prévue : ${context.weather.summary}, de ${context.weather.min} à ${context.weather.max} °C. Mode conseillé : ${context.weather.recommended?.label} (${context.weather.recommended?.reason}).` : ''}
Trafic à Paris (taux d'occupation moyen des capteurs) : ${traffic}.

Tu réponds UNIQUEMENT avec un objet JSON : {"reply": "ta réponse", "action": {"type": "...", "value": "..."}}.
Types d'action possibles (utilise "none" par défaut) :
- setPriority avec value "time", "cost" ou "co2" quand l'usager veut gagner du temps, dépenser moins ou polluer moins ;
- setMode avec value "car", "transit", "bike" ou "walk" ;
- optimize pour recalculer ;
- startGuidance pour démarrer le guidage vocal ;
- nextStep quand l'usager dit qu'il est arrivé à l'étape ;
- openPage avec value "planner", "dashboard", "privacy", "account" ou "history" ;
- addStops quand l'usager décrit sa journée ou des démarches à faire (« je dois passer à la mairie, à la pharmacie puis faire les courses ») : value est une liste d'objets {"query": "lieu à rechercher, précis, avec le quartier ou la ville si l'usager l'a dit", "category": une valeur parmi ${CATEGORY_IDS.join(", ")}, "constraint": {"type": "before" (« avant 17h ») ou "after" (« pas avant 14h », « après 14h »), "time": "HH:MM" au format 24 h, par exemple "17:00"} dès que l'usager donne une heure pour cette étape, "items": liste d'articles seulement si l'usager dicte une liste de courses}. Pour un lieu générique (« la pharmacie »), mets juste « pharmacie » : l'application cherchera la plus proche. Dans "reply", récapitule les étapes ajoutées.`;
}

// Moteur de repli sans IA générative : intentions par mots-clés.
function localReply(messages, context, traffic) {
  const text = messages[messages.length - 1].content.toLowerCase();
  const plan = context?.plan;
  const steps = plan?.steps || [];
  const g = context?.guidance;
  const has = (...words) => words.some((w) => text.includes(w));
  const asking = has('pourquoi', 'comment', '?');

  if (has('donnée', 'confidential', 'historique', 'vie privée', 'traçage', 'tracé', 'rgpd', 'gardez', 'conserv', 'stock', 'espionn')) {
    return {
      reply: "Vos trajets sont calculés puis effacés : aucun historique n'est conservé. Votre compte ne stocke que votre email, votre mot de passe haché et vos préférences.",
      action: { type: 'none' },
    };
  }
  if (!asking && has('moins cher', 'économ', 'dépenser moins', 'argent')) {
    return { reply: "C'est noté, je privilégie le trajet le moins cher et je recalcule.", action: { type: 'setPriority', value: 'cost' } };
  }
  if (!asking && has('polluer moins', 'écolo', 'co2', 'planète', 'moins polluant')) {
    return { reply: 'Très bien, je privilégie le trajet le moins polluant et je recalcule.', action: { type: 'setPriority', value: 'co2' } };
  }
  if (!asking && has('plus rapide', 'gagner du temps', 'pressé')) {
    return { reply: 'Compris, je privilégie le trajet le plus rapide.', action: { type: 'setPriority', value: 'time' } };
  }
  if (!asking && has('vélo')) return { reply: 'Je passe en vélo et je recalcule votre journée.', action: { type: 'setMode', value: 'bike' } };
  if (!asking && has('voiture')) return { reply: 'Je passe en voiture et je recalcule.', action: { type: 'setMode', value: 'car' } };
  if (!asking && has('métro', 'bus', 'transport')) return { reply: 'Je passe en transports en commun et je recalcule.', action: { type: 'setMode', value: 'transit' } };
  if (!asking && has('à pied', 'marche', 'marcher')) return { reply: 'Je passe à pied et je recalcule.', action: { type: 'setMode', value: 'walk' } };
  if (has('suis arrivé', 'suis arrivée', 'je suis là', 'on est arrivé', 'étape suivante')) {
    return { reply: 'Parfait, je passe à l’étape suivante.', action: { type: 'nextStep' } };
  }
  if (has('démarre', 'guidage', 'on y va', 'c’est parti', "c'est parti", 'lance le')) {
    return { reply: 'C’est parti, je lance le guidage vocal.', action: { type: 'startGuidance' } };
  }
  if (!steps.length) {
    if (traffic && has('trafic', 'bouchon', 'embouteillage', 'fluide')) {
      const days = traffic.days.slice(0, 5);
      const avg = Array.from({ length: 24 }, (_, h) => days.reduce((sum, d) => sum + d[h].k, 0) / 5);
      const day = avg.map((k, h) => ({ k, h })).filter((x) => x.h >= 7 && x.h <= 20);
      const peak = day.reduce((a, b) => (b.k > a.k ? b : a));
      const calm = day.reduce((a, b) => (b.k < a.k ? b : a));
      return {
        reply: `D'après les capteurs routiers de la Ville de Paris, en semaine le trafic est le plus dense vers ${peak.h}h et le plus fluide vers ${calm.h}h, en journée. Partir à ce moment-là peut vous faire gagner de précieuses minutes.`,
        action: { type: 'none' },
      };
    }
    return {
      reply: "Listez vos étapes de la journée, choisissez votre priorité et je m'occupe de l'ordre. Vous pouvez me demander pourquoi une étape est placée là, ou ce qui vous attend ensuite.",
      action: { type: 'openPage', value: 'planner' },
    };
  }
  const next = g ? steps[g.index] : steps[0];
  if (has('pourquoi')) {
    const target = steps.find((s) => text.includes(s.label.toLowerCase()));
    if (target) return { reply: `${target.label} : ${target.explanation}`, action: { type: 'none' } };
    const reasons = steps.slice(0, 3).map((s) => s.explanation).join(' ');
    return { reply: `${(plan.summary || [])[0] || "J'ai testé tous les ordres possibles."} ${reasons}`, action: { type: 'none' } };
  }
  if (has('prochain', 'suivant', 'ensuite', 'où je vais', 'après')) {
    return {
      reply: next ? `Prochaine étape : ${next.label}, arrivée prévue à ${next.arrival}. ${next.explanation}` : 'Il ne reste plus que le retour. Bonne fin de journée !',
      action: { type: 'none' },
    };
  }
  if (has('combien', 'durée', 'temps', 'quelle heure', 'finir', 'fini')) {
    const t = plan.totals;
    return {
      reply: `Votre journée dure ${t.durationMin} minutes au total, pour ${t.km} kilomètres, environ ${t.cost} euros et ${t.co2} kilos de CO2. Retour prévu à ${plan.endTime || t.endTime}.`,
      action: { type: 'none' },
    };
  }
  if (has('bonjour', 'salut', 'hello', 'coucou')) {
    return { reply: `Bonjour ! Votre journée compte ${steps.length} étapes. Voulez-vous que je lance le guidage ?`, action: { type: 'none' } };
  }
  return {
    reply: `Votre trajet commence par ${steps[0].label} à ${steps[0].arrival}. ${(plan.summary || [])[0] || ''} Demandez-moi pourquoi une étape est placée là, ou dites « c'est parti » pour le guidage.`,
    action: { type: 'none' },
  };
}

export const assistantRouter = Router();

assistantRouter.get('/status', (_req, res) => {
  res.json({ ai: aiEnabled(), model: aiEnabled() ? AI_MODEL : 'règles locales' });
});

assistantRouter.post('/', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Requête invalide' });
  const { messages, context } = parsed.data;
  res.set('Cache-Control', 'no-store');

  const traffic = await getTraffic().catch(() => null);
  const local = () => ({ ...localReply(messages, context, traffic), engine: 'local' });
  if (!aiEnabled()) return res.json(local());

  try {
    const digest = await trafficDigest();
    const r = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}) },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.4,
        max_tokens: 900,
        ...(AI_MODEL.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}),
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: systemPrompt(context, digest) }, ...messages],
      }),
    });
    if (!r.ok) throw new Error(`IA HTTP ${r.status}`);
    const json = await r.json();
    const raw = json.choices?.[0]?.message?.content || '';
    if (process.env.DEBUG_AI) console.log('IA brute :', raw);
    let out;
    try {
      out = JSON.parse(raw);
    } catch {
      out = { reply: raw, action: { type: 'none' } };
    }
    let action = ACTIONS.includes(out.action?.type) ? out.action : { type: 'none' };
    if (action.type === 'addStops') {
      const value = cleanStops(action.value);
      action = value ? { type: 'addStops', value } : { type: 'none' };
    }
    res.json({ reply: String(out.reply || '').slice(0, 1200), action, engine: AI_MODEL });
  } catch {
    res.json(local());
  }
});
