import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, History, Home, Route, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect } from 'react';
import Logo from './Logo';
import Assistant from './Assistant';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';

const NAV = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/planifier', label: 'Planifier', icon: Route },
  { to: '/mes-trajets', label: 'Mes trajets', icon: History, match: ['/mes-trajets', '/trajet'] },
  { to: '/ville', label: 'Ma ville', icon: BarChart3 },
  { to: '/confidentialite', label: 'Confidentialité', icon: ShieldCheck },
];

export default function Layout() {
  const { user } = useAuth();
  const { result } = useTrip();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[2000] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Aller au contenu
      </a>
      <header className="sticky top-0 z-[1000] border-b border-line/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="TrajectAI, accueil">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navigation principale">
            {NAV.map(({ to, label, end, match }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `relative rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive || match?.includes(pathname) ? 'text-brand-700' : 'text-muted hover:text-ink'}`
                }
              >
                {({ isActive }) => (
                  <>
                    {label}
                    {to === '/mes-trajets' && result && <span className="absolute top-1.5 right-1 h-2 w-2 rounded-full bg-brand-500" />}
                    {(isActive || match?.includes(pathname)) && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-brand-500" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
          <Link
            to={user ? '/compte' : '/connexion'}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold hover:border-brand-400"
          >
            <UserRound size={18} />
            <span className="hidden sm:inline">{user ? 'Mon compte' : 'Se connecter'}</span>
          </Link>
        </div>
      </header>

      <main id="contenu" className="flex-1 pb-44 md:pb-24">
        <Outlet />
      </main>

      <footer className="hidden border-t border-line bg-white md:block">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 text-sm text-muted md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo />
            <p className="mt-3 max-w-md">
              Le citoyen liste, l'IA optimise, la ville informe, l'usager contrôle. Projet DataCity EFREI — thématique MOVECITY.
            </p>
          </div>
          <div>
            <p className="font-bold text-ink">Produit</p>
            <ul className="mt-3 space-y-2">
              <li><Link to="/planifier" className="hover:text-ink">Planifier ma journée</Link></li>
              <li><Link to="/ville" className="hover:text-ink">La mobilité de ma ville</Link></li>
              <li><Link to="/confidentialite" className="hover:text-ink">Politique de confidentialité</Link></li>
            </ul>
          </div>
          <div>
            <p className="font-bold text-ink">Données ouvertes</p>
            <ul className="mt-3 space-y-2">
              <li><a className="hover:text-ink" href="https://opendata.paris.fr" target="_blank" rel="noreferrer">opendata.paris.fr</a></li>
              <li><a className="hover:text-ink" href="https://impactco2.fr" target="_blank" rel="noreferrer">ADEME Impact CO₂</a></li>
              <li><a className="hover:text-ink" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a></li>
            </ul>
          </div>
        </div>
      </footer>

      {/* Barre d'onglets mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-[1000] border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Navigation mobile"
      >
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon, end, match }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${isActive || match?.includes(pathname) ? 'text-brand-600' : 'text-muted'}`
              }
            >
              <Icon size={21} strokeWidth={2.2} />
              {label === 'Confidentialité' ? 'Données' : label}
              {to === '/mes-trajets' && result && <span className="absolute top-2 right-[30%] h-2 w-2 rounded-full bg-brand-500" />}
            </NavLink>
          ))}
        </div>
      </nav>

      <Assistant />
    </div>
  );
}
