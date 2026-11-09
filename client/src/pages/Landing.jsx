import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Bike,
  Bot,
  Bus,
  Car,
  EyeOff,
  Footprints,
  Mic,
  CloudSun,
  ScanSearch,
  ShoppingBasket,
  Lock,
  MessageSquareText,
  Trash2,
} from 'lucide-react';
import { useTrip } from '../context/TripContext';

const STEPS = [
  { title: 'Lister', text: "Saisissez vos démarches de la journée, dans n'importe quel ordre." },
  { title: 'Optimiser', text: "L'IA croise trafic, affluence et horaires pour trouver le meilleur enchaînement." },
  { title: 'Informer', text: '« Mairie placée à 15h : 20 min de file évitées. » Chaque choix est expliqué.' },
  { title: 'Contrôler', text: 'Changez votre priorité ou l’ordre à tout moment. Rien n’est conservé.' },
];

const PREVIEW = [
  { n: 1, label: 'École Keller', time: '8h13', note: 'Avant 8h30, comme demandé', color: '#e0508f' },
  { n: 2, label: 'Monoprix Voltaire', time: '8h31', note: '~12 min de file évitées', color: '#16a34a' },
  { n: 3, label: 'Point relais', time: '9h06', note: 'Affluence 30 % au lieu de 95 %', color: '#f59e0b' },
  { n: 4, label: 'Mairie du 11e', time: '9h31', note: 'Avant le rush de midi', color: '#7c5cf0' },
];

export default function Landing() {
  const { loadDemo } = useTrip();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pt-10 pb-14 sm:px-6 lg:grid-cols-2 lg:pt-20 lg:pb-24">
          <div className="animate-fade-up">
            <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">Paris · Mobilité du quotidien</p>
            <h1 className="mt-5 text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              L'IA organise vos trajets,
              <br />
              <span className="text-brand-500">vous choisissez</span> votre priorité.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted">
              École, travail, mairie, courses, colis… Listez vos étapes : TrajectAI trouve l'ordre qui vous fait gagner du temps, de l'argent ou du CO₂, et vous
              explique pourquoi. <strong className="text-ink">Sans jamais garder vos trajets.</strong>
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/planifier" className="btn-primary !px-7 !py-4 text-base">
                Planifier ma journée <ArrowRight size={19} />
              </Link>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event('traject:voice-open'))}
                className="btn-ghost !px-7 !py-4 text-base"
              >
                <Mic size={19} className="text-brand-600" /> Dicter ma journée
              </button>
            </div>
            <div className="mt-3">
              <Link to="/planifier" onClick={loadDemo} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                ou voir un exemple <ArrowRight size={15} />
              </Link>
            </div>
            <div className="mt-8 flex items-center gap-5 text-muted">
              {[Car, Bus, Bike, Footprints].map((I, i) => (
                <I key={i} size={22} />
              ))}
              <span className="text-sm">4 modes comparés · données ouvertes de Paris</span>
            </div>
          </div>

          <div className="relative animate-fade-up [animation-delay:120ms]">
            <figure>
              <img
                src="/photos/rue-paris.webp"
                alt="Rue parisienne animée, avec des passants, un bus et des vélos"
                width="1200"
                height="800"
                fetchPriority="high"
                className="aspect-[4/3] w-full rounded-3xl object-cover object-[72%_50%] shadow-sm lg:aspect-[5/4]"
              />
            </figure>
            <div className="card absolute -bottom-8 left-2 w-[min(88%,340px)] p-4 sm:left-8">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-extrabold">Trajet optimisé</p>
                <span className="chip bg-brand-50 text-brand-700">−25 min</span>
              </div>
              <ol className="space-y-2.5">
                {PREVIEW.map((p) => (
                  <li key={p.n} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white" style={{ background: p.color }}>
                      {p.n}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.label}</span>
                      <span className="block truncate text-[11px] text-muted">{p.note}</span>
                    </span>
                    <span className="text-sm font-bold">{p.time}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-bold tracking-wider text-brand-600 uppercase">Notre principe</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Le citoyen liste, l'IA optimise, la ville informe, l'usager contrôle.</h2>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ title, text }, i) => (
            <div key={title} className="border-t-2 border-ink pt-5">
              <span className="text-sm font-bold text-brand-700">0{i + 1}</span>
              <h3 className="mt-1 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Photos : la ville réelle */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-4 md:grid-cols-5">
          <div className="flex flex-col justify-center md:col-span-2 md:pr-6">
            <p className="text-sm font-bold tracking-wider text-brand-600 uppercase">Pensé pour Paris</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">Métro, Vélib', bus ou à pied : on compare pour vous.</h2>
            <p className="mt-4 text-muted">
              TrajectAI s'appuie sur les données ouvertes de la Ville de Paris : capteurs de trafic, stations Vélib' en temps réel et émissions de CO₂ de
              l'ADEME. Le bon mode dépend de l'heure, de la météo et de vos étapes.
            </p>
          </div>
          <img src="/photos/metro.webp" alt="Entrée de la station de métro Nationale, ligne 6, à Paris" loading="lazy" width="800" height="1115" className="aspect-[4/5] w-full rounded-3xl object-cover md:col-span-1 md:aspect-auto md:h-full" />
          <img src="/photos/velib.webp" alt="Station Vélib' avec une rangée de vélos en libre-service" loading="lazy" width="800" height="1200" className="aspect-[4/5] w-full rounded-3xl object-cover md:col-span-2 md:aspect-auto md:h-96" />
        </div>
      </section>

      {/* IA vocale + dashboard */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-16 sm:px-6 lg:grid-cols-2">
        <div className="card flex flex-col p-7">
          <Bot size={28} className="text-brand-700" />
          <h3 className="mt-5 text-2xl font-extrabold">Traject, votre copilote IA</h3>
          <p className="mt-2 text-muted">
            Dites simplement « mairie avant 17h, pharmacie et courses » : Traject crée les étapes, trouve les lieux les plus proches et calcule le meilleur ordre.
            Il répond à voix haute et vous annonce chaque arrivée.
          </p>
          <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <li className="flex items-center gap-2"><ScanSearch size={16} className="text-brand-600" /> Filmez la rue : l’IA trouve où vous êtes</li>
            <li className="flex items-center gap-2"><CloudSun size={16} className="text-brand-600" /> Conseil selon la météo de la journée</li>
            <li className="flex items-center gap-2"><ShoppingBasket size={16} className="text-brand-600" /> Temps de courses estimé selon votre liste</li>
            <li className="flex items-center gap-2"><Mic size={16} className="text-brand-600" /> Questions et guidage à la voix</li>
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            {['« Quelle est la prochaine étape ? »', '« C’est parti ! »', '« Je suis arrivé »'].map((q) => (
              <span key={q} className="chip bg-canvas !py-2 text-ink">
                <MessageSquareText size={13} /> {q}
              </span>
            ))}
          </div>
        </div>
        <div className="card flex flex-col p-7">
          <BarChart3 size={28} className="text-brand-700" />
          <h3 className="mt-5 text-2xl font-extrabold">La mobilité de ma ville, en clair</h3>
          <p className="mt-2 text-muted">
            Trafic heure par heure mesuré par les capteurs de la Ville de Paris, Vélib' disponibles en temps réel, émissions de CO₂ par mode selon l'ADEME.
          </p>
          <Link to="/ville" className="btn-ghost mt-auto w-fit !mt-6">
            Explorer le dashboard <ArrowRight size={17} />
          </Link>
        </div>
      </section>

      {/* Confiance */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold tracking-wider text-brand-600 uppercase">Confiance</p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Une IA efficace, jamais intrusive.</h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              { icon: Trash2, t: 'Zéro historique', d: 'Vos trajets sont calculés puis effacés. Aucune base de données ne contient vos déplacements.' },
              { icon: EyeOff, t: 'Pas de suivi en continu', d: 'La position n’est lue que si vous activez la détection d’arrivée, et reste sur votre téléphone.' },
              { icon: Lock, t: 'Compte minimal', d: 'Email, mot de passe haché et préférences. Rien d’autre. Suppression en un clic.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-4">
                <Icon size={22} className="mt-0.5 shrink-0 text-brand-700" />
                <div>
                  <h3 className="font-extrabold">{t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Slogan */}
      <section className="bg-ink py-20 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <svg viewBox="0 0 300 40" className="mx-auto mb-8 h-8 w-64" aria-hidden="true">
            <path d="M10 30 H290" stroke="#1aa86c" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
            <circle cx="10" cy="30" r="7" fill="#1aa86c" />
            <circle cx="110" cy="30" r="5" fill="#fff" />
            <circle cx="190" cy="30" r="5" fill="#fff" />
            <path d="M290 6c-5 0-9 4-9 9 0 7 9 15 9 15s9-8 9-15c0-5-4-9-9-9z" fill="#fff" />
          </svg>
          <p className="text-3xl leading-tight font-extrabold sm:text-5xl">
            Une ville qui pense vos trajets pour vous faire <span className="text-brand-400">gagner du temps</span>, pas pour vous en faire perdre.
          </p>
          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/planifier" className="btn-brand !px-8 !py-4 text-base">
              Commencer
            </Link>
            <Link to="/connexion" className="btn border border-white/25 !px-8 !py-4 text-base text-white hover:bg-white/10">
              Se connecter
            </Link>
          </div>
          <p className="mt-12 text-xs text-white/50">Photos : Unsplash (Frédéric Barriol, Jimmy Woo et contributeurs), licence Unsplash.</p>
        </div>
      </section>
    </div>
  );
}
