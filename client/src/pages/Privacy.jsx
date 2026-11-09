import { Link } from 'react-router-dom';
import { Check, ShieldCheck, X } from 'lucide-react';

const KEPT = [
  ['Votre email', 'Pour vous connecter. Uniquement si vous créez un compte.'],
  ['Votre mot de passe, haché', 'Chiffré de façon irréversible (bcrypt) : personne, pas même nous, ne peut le lire.'],
  ['Vos préférences', 'Priorité et mode par défaut, voix activée ou non.'],
  ['Vos lieux favoris', 'Seulement si vous activez l’option. Effacés dès que vous la désactivez.'],
];
const NEVER = [
  'L’historique de vos trajets sur nos serveurs',
  'Les photos analysées par « Où suis-je ? »',
  'Votre position en continu',
  'Vos conversations avec l’assistant',
  'Des cookies publicitaires ou de pistage',
];

const SECTIONS = [
  {
    t: 'Qui est responsable ?',
    d: 'TrajectAI est un projet étudiant réalisé dans le cadre du challenge DataCity de l’EFREI (thème MOVECITY). L’équipe projet est responsable du traitement. Pour toute question : utilisez la page Mon compte ou écrivez à l’équipe via l’EFREI.',
  },
  {
    t: 'Comment votre trajet est-il calculé ?',
    d: 'Quand vous cliquez sur « Optimiser », vos étapes (nom et coordonnées) sont envoyées à notre serveur, qui calcule le meilleur ordre puis renvoie le résultat. Le serveur ne journalise pas ces données et ne les écrit jamais sur disque. Dans votre navigateur, le trajet n’existe qu’en mémoire : fermer l’onglet ou cliquer sur « Effacer ce trajet » le supprime.',
  },
  {
    t: 'Et la géolocalisation ?',
    d: 'Elle n’est utilisée que dans deux cas, et toujours à votre demande : le bouton « ma position » (lecture unique pour remplir le départ) et la « détection auto » pendant le guidage. Dans ce second cas, la comparaison entre votre position et l’étape se fait dans votre téléphone ; la position n’est jamais envoyée à nos serveurs et le suivi s’arrête avec le guidage.',
  },
  {
    t: 'Historique et adresses récentes (option)',
    d: 'Désactivés par défaut. Si vous les activez, vos trajets et adresses récentes sont enregistrés uniquement dans le navigateur de votre appareil : ils ne sont jamais envoyés à nos serveurs. Vous pouvez les effacer ou désactiver l’option à tout moment depuis « Mes trajets ».',
  },
  {
    t: '« Où suis-je ? » (caméra)',
    d: 'La caméra ne s’active que lorsque vous ouvrez cette fonction. L’image capturée est envoyée une seule fois à un modèle de vision open source (Qwen, via Groq) pour lire les plaques et enseignes, puis elle est oubliée : ni TrajectAI ni la page ne la conservent.',
  },
  {
    t: 'Météo',
    d: 'Pour adapter le conseil de mode de transport, les coordonnées arrondies (à environ 1 km) de votre point de départ sont envoyées au service gratuit Open-Meteo. Aucune autre donnée n’est transmise.',
  },
  {
    t: 'L’assistant vocal Traject',
    d: 'La reconnaissance et la synthèse vocales utilisent les fonctions de votre navigateur (selon le navigateur, l’audio peut être traité par son éditeur, par exemple Google pour Chrome). Le texte de votre question et un résumé du trajet en cours sont transmis au modèle d’IA configuré (GPT-OSS 120B via Groq, ou un modèle local Ollama) ; si vous dictez votre journée, les lieux cités sont ensuite recherchés près de votre point de départ pour générer la réponse, sans être conservés par TrajectAI. Si aucun modèle n’est configuré, un moteur de règles local répond.',
  },
  {
    t: 'Qui intervient techniquement ?',
    d: 'Supabase (authentification et préférences, hébergement dans l’Union européenne recommandé), Photon / OpenStreetMap et la Base Adresse Nationale (recherche de lieux), OSRM (calcul d’itinéraires), OpenStreetMap (fond de carte), Groq (modèle d’IA, si activé). Seules les données strictement nécessaires à chaque service lui sont transmises.',
  },
  {
    t: 'Base légale et durée de conservation',
    d: 'Compte et préférences : exécution du service que vous demandez (art. 6.1.b du RGPD), conservés tant que votre compte existe. Trajets : aucune conservation. Sur votre appareil uniquement : la session de connexion, votre réglage de voix et un compteur mensuel agrégé de vos économies (minutes, euros, CO₂, sans aucun lieu).',
  },
  {
    t: 'Vos droits',
    d: 'Vous pouvez à tout moment consulter, modifier, exporter (portabilité) et supprimer vos données depuis la page Mon compte. La suppression du compte est immédiate et définitive. Vous pouvez aussi introduire une réclamation auprès de la CNIL (cnil.fr).',
  },
  {
    t: 'Sécurité',
    d: 'Connexions chiffrées (HTTPS), mots de passe hachés, règles d’accès en base (Row Level Security) garantissant que chaque utilisateur n’accède qu’à sa propre ligne, validation stricte des requêtes, limitation du nombre d’appels et en-têtes de sécurité HTTP côté serveur.',
  },
];

export default function Privacy() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-14">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <ShieldCheck size={28} />
      </span>
      <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">Politique de confidentialité</h1>
      <p className="mt-3 text-lg text-muted">En français clair : ce que TrajectAI garde, ce qu’il ne garde jamais, et vos droits.</p>
      <p className="mt-1 text-xs text-muted">Dernière mise à jour : septembre 2026</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-extrabold">Ce que nous conservons</h2>
          <ul className="mt-4 space-y-3">
            {KEPT.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <Check size={18} className="mt-0.5 shrink-0 text-brand-600" />
                <span>
                  <strong className="block text-sm">{t}</strong>
                  <span className="text-sm text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="card border-red-100 p-6">
          <h2 className="font-extrabold">Ce que nous ne conservons jamais</h2>
          <ul className="mt-4 space-y-3">
            {NEVER.map((t) => (
              <li key={t} className="flex gap-3 text-sm">
                <X size={18} className="mt-0.5 shrink-0 text-red-500" />
                {t}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-8 space-y-4">
        {SECTIONS.map(({ t, d }) => (
          <section key={t} className="card p-6">
            <h2 className="font-extrabold">{t}</h2>
            <p className="mt-2 leading-relaxed text-muted">{d}</p>
          </section>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link to="/compte" className="btn-primary">
          Gérer mes données
        </Link>
        <Link to="/planifier" className="btn-ghost">
          Planifier sans compte
        </Link>
      </div>
    </div>
  );
}
