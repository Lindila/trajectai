# TrajectAI

> **Le citoyen liste, l'IA optimise, la ville informe, l'usager contrôle.**
> Projet DataCity EFREI — thématique **MOVECITY** : « Une ville qui fluidifie les mobilités quotidiennes ».

TrajectAI permet à un actif ou un parent de saisir 2 à 6 démarches de sa journée et d'obtenir en quelques secondes **l'ordre de passage optimal, expliqué**, selon la priorité choisie (temps, argent ou CO₂), **sans qu'aucun trajet ne soit conservé**. Un assistant IA vocal, Traject, répond aux questions et annonce chaque arrivée.

🌐 **En ligne : https://trajectai-paris.vercel.app**

📄 Documentation d'architecture complète : `livrables/TrajectAI_Documentation_Architecture_J4.docx`

Équipe : Cyril DABERNARD · Nono Yvana NOUTCHANG · Kavisha RUBAKANTHAN · Luân TA · Ywen MASSON · Noussirath BELLO

---

## Démarrage rapide (5 minutes)

Prérequis : [Node.js 18+](https://nodejs.org).

```bash
npm run setup            # installe la racine, le serveur et le client
cp server/.env.example server/.env
cp client/.env.example client/.env
npm run dev              # API sur :3001 + site sur http://localhost:5173
```

L'application fonctionne **immédiatement sans aucune clé** : planification, carte, dashboard et assistant (en mode « règles locales »). Les deux étapes suivantes activent les comptes et l'IA générative.

### 1. Activer les comptes (Supabase, gratuit)

1. Créez un projet sur [supabase.com](https://supabase.com) (région **Europe** recommandée pour le RGPD).
2. *SQL Editor* → collez et exécutez [`supabase/schema.sql`](supabase/schema.sql).
3. *Project Settings → API* : copiez l'URL et la clé `anon` dans `client/.env` :
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
4. *Authentication → URL Configuration* : ajoutez `http://localhost:5173` (et l'URL de production) aux URL autorisées.

### 2. Activer l'IA générative (gratuit, modèle open source)

1. Créez une clé sur [console.groq.com/keys](https://console.groq.com/keys).
2. Dans `server/.env` : `AI_API_KEY=gsk_...` (modèle par défaut : **GPT-OSS 120B**, open source).
3. Relancez `npm run dev`. L'en-tête de l'assistant affiche « IA open source · openai/gpt-oss-120b ».

Alternative 100 % locale : installez [Ollama](https://ollama.com), lancez `ollama pull llama3.2`, puis `AI_BASE_URL=http://localhost:11434/v1` et `AI_MODEL=llama3.2`.

> La voix (reconnaissance + synthèse) utilise la Web Speech API du navigateur : elle fonctionne au mieux sur **Chrome ou Edge**. Le micro exige `localhost` ou HTTPS.

---

## Ce que fait l'application

| Page | Rôle |
|---|---|
| `/` | Page d'accueil (landing) : proposition de valeur, principe, confiance |
| `/planifier` | **Lister** : départ, 2 à 6 arrêts (type détecté automatiquement), contraintes horaires, mode, priorité. Bouton « Essayer un exemple » pour la démo |
| `/trajet` | **Optimiser / Informer / Contrôler** : carte, temps-coût-CO₂, gain vs l'ordre saisi, explication par étape, réorganisation manuelle, changement de priorité ou de mode instantané, comparaison des 4 modes, conseil d'heure de départ, **guidage vocal** avec détection d'arrivée (GPS local ou simulation de démo), bouton « Effacer ce trajet » |
| `/mes-trajets` | **Historique** (facultatif, stocké uniquement dans le navigateur) : récents, favoris, « Relancer pour aujourd'hui », économies du mois |
| `/ville` | **Dashboard « La mobilité de ma ville »** : trafic par heure et par jour, heatmap de saturation, CO₂ par mode, Vélib' en temps réel (+ tableaux de données accessibles) |
| `/confidentialite` | Politique de confidentialité en français clair |
| `/connexion`, `/compte` | Inscription/connexion, préférences, lieux favoris (opt-in), export JSON, suppression du compte |
| Recherche de lieu | Tri **à proximité** du départ, adresses récentes, bouton caméra **« Où suis-je ? »** (vision IA open source Qwen) |
| Mon trajet | **Météo** heure par heure (Open-Meteo) et mode conseillé ; **liste de courses** qui ajuste le temps au supermarché |
| Orbe ronde en bas à droite | **Traject en mode vocal** : on parle directement, on peut **dicter sa journée** (l'IA crée les étapes et calcule) |
| Bulle en bas à droite | **Traject**, l'assistant IA : texte ou voix, répond à voix haute, peut changer la priorité/le mode, lancer le guidage, passer à l'étape suivante |

### Scénario de démonstration pour le jury

1. `/planifier` → **Essayer un exemple** (journée type dans le 11e : école avant 8h30, mairie, Monoprix, point relais, salle de sport).
2. **Optimiser mon trajet** → montrer le gain (« −20 min ») et les explications (« ~14 min de file évitées »).
3. Changer la priorité en **Polluer moins**, puis déplacer une étape avec les flèches : l'usager garde le contrôle.
4. Ouvrir Traject et demander au micro : « Pourquoi cet ordre ? », puis « C'est parti ».
5. **Simuler le trajet (démo)** : la voix annonce chaque arrivée.
6. `/ville` pour les données ouvertes, puis **Effacer ce trajet** pour prouver le zéro historique.

---

## Architecture

```
TrajectAI/
├── client/                 React 19 + Vite + Tailwind CSS 4 (responsive, mobile d'abord)
│   └── src/
│       ├── pages/          Landing, Planner, Result, Dashboard, Privacy, Auth, Account
│       ├── components/     Assistant (IA + voix), TripMap (Leaflet), GuidancePanel, PlaceSearch…
│       ├── context/        TripContext (trajet en mémoire uniquement), AuthContext (Supabase)
│       └── lib/            api, supabase, speech (Web Speech API), constantes
├── server/                 Node.js + Express (sans base de données)
│   ├── src/lib/optimizer.js   Moteur d'optimisation explicable
│   ├── src/lib/profiles.js    Coûts, CO₂ ADEME, horaires et affluence par type de lieu
│   ├── src/lib/routing.js     Temps de trajet OSRM (+ repli à vol d'oiseau)
│   ├── src/lib/opendata.js    Données Ville de Paris (cache + instantané de secours)
│   ├── src/routes/            /optimize, /geocode, /city, /assistant
│   ├── data/                  Instantanés open data (si l'API de la ville est indisponible)
│   └── test/                  Tests unitaires (npm test)
└── supabase/schema.sql     Table preferences + RLS + suppression de compte
```

```
Navigateur ──► API Node (sans état) ──► OSRM (itinéraires), Photon/BAN (lieux),
    │                                   opendata.paris.fr (trafic, Vélib'), Groq/Ollama (IA)
    └──────► Supabase Auth + table preferences (RLS)
```

### Le moteur d'« IA » explicable

Conformément au MVP, l'IA est un **algorithme d'optimisation explicable**, pas une boîte noire :

1. Matrice des temps et distances entre tous les points (OSRM / OpenStreetMap) pour chaque mode.
2. Pour chacun des ordres possibles (jusqu'à 6! = 720), simulation de la journée minute par minute : trajet ajusté par le **taux d'occupation réel des routes** à l'heure concernée, attente d'ouverture, **file d'attente selon l'affluence horaire** du lieu, durée sur place, contraintes « avant / pas avant ».
3. Score selon la priorité : `temps + coût + CO₂` pondérés, avec forte pénalité si une contrainte ou un horaire d'ouverture n'est pas respecté.
4. Génération d'explications chiffrées pour chaque étape, du gain par rapport à l'ordre saisi, et d'un conseil d'heure de départ.

### Sources de données

| Donnée | Source | Usage |
|---|---|---|
| Débit et taux d'occupation horaires des routes | [Ville de Paris — Comptages routiers permanents](https://opendata.paris.fr/explore/dataset/comptages-routiers-permanents/) (ODbL), agrégés par jour × heure | Temps de trajet voiture/bus, dashboard |
| Disponibilité Vélib' | [Vélib' Métropole — temps réel](https://opendata.paris.fr/explore/dataset/velib-disponibilite-en-temps-reel/) (ODbL) | Dashboard |
| Émissions par mode | [ADEME — Impact CO₂](https://impactco2.fr) | Calcul CO₂, dashboard |
| Itinéraires | [OSRM](https://project-osrm.org) / OpenStreetMap | Temps et distances, tracé |
| Recherche de lieux | [Photon](https://photon.komoot.io) (OSM) + [Base Adresse Nationale](https://adresse.data.gouv.fr) | Autocomplétion, type de lieu |
| Affluence des lieux | **Profils types modélisés** (pics du midi et de fin de journée) dans `profiles.js` | File d'attente estimée |

⚠️ À dire honnêtement au jury : l'affluence des guichets et commerces n'existe pas en open data ; ce sont des profils modélisés, à remplacer par des données réelles de fréquentation si la ville les ouvre. Le transport en commun est estimé (distance / vitesse commerciale + accès), faute de calculateur ouvert gratuit.

Rafraîchir les instantanés : `npm run refresh-data`.

---

## Sécurité et confidentialité (pour la filière cybersécurité)

- **Zéro historique** : l'API n'a pas de base de données, ne journalise aucune requête, répond avec `Cache-Control: no-store`. Côté navigateur, le trajet vit en mémoire React (pas de `localStorage`).
- **Géolocalisation** : uniquement à la demande (bouton « ma position » ponctuel) ou pendant le guidage si l'usager l'active ; la comparaison de distance se fait dans le navigateur, la position n'est jamais envoyée.
- **Compte minimal** : Supabase Auth (bcrypt) + table `preferences` protégée par **Row Level Security** ; trigger qui vide les favoris si le consentement est retiré ; fonction `delete_my_account()` (droit à l'effacement) ; export JSON (portabilité).
- **API** : validation stricte des entrées (zod), limite de taille des corps (50 ko), `helmet` (en-têtes HTTP), CORS restreint, **rate limiting** par route, clé IA uniquement côté serveur.
- Sur l'appareil seulement : session Supabase, réglage « voix », compteur mensuel agrégé des économies (aucun lieu).

Points à auditer en priorité : injection de prompt via les libellés d'étapes (l'assistant ne peut déclencher qu'une liste fermée d'actions côté client), dépendance aux services tiers (Groq hors UE → proposer Ollama), abus de l'API (rate limit), politique de mot de passe Supabase (à régler dans *Authentication → Policies*).

---

## Déploiement

Le site **et** l’API sont déployés ensemble sur Vercel (voir `vercel.json` : le front `client/dist` + l’API Express en fonction serverless `api/index.js`, région Paris `cdg1`).

```bash
npx vercel login
npx vercel deploy --prod
```

Variables à définir dans Vercel : `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Dans Supabase (*Authentication → URL Configuration*), mettre l’URL du site en *Site URL*.

## Scripts

| Commande | Effet |
|---|---|
| `npm run setup` | Installe toutes les dépendances |
| `npm run dev` | Lance API + site en parallèle |
| `npm run build` | Build de production du site (`client/dist`) |
| `npm test` | Tests unitaires du moteur d'optimisation |
| `npm run refresh-data` | Met à jour les instantanés open data |
