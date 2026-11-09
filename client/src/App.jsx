import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Layout from './components/Layout';
import Landing from './pages/Landing';

const Planner = lazy(() => import('./pages/Planner'));
const Result = lazy(() => import('./pages/Result'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Auth = lazy(() => import('./pages/Auth'));
const Account = lazy(() => import('./pages/Account'));
const History = lazy(() => import('./pages/History'));

const Page = ({ children }) => (
  <Suspense
    fallback={
      <div className="flex justify-center py-24 text-brand-500">
        <Loader2 size={32} className="animate-spin" />
      </div>
    }
  >
    {children}
  </Suspense>
);

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-6xl font-extrabold text-brand-500">404</p>
      <h1 className="mt-3 text-2xl font-extrabold">Cette page a pris un autre itinéraire</h1>
      <Link to="/" className="btn-primary mt-6">
        Retour à l'accueil
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="planifier" element={<Page><Planner /></Page>} />
        <Route path="trajet" element={<Page><Result /></Page>} />
        <Route path="mes-trajets" element={<Page><History /></Page>} />
        <Route path="ville" element={<Page><Dashboard /></Page>} />
        <Route path="confidentialite" element={<Page><Privacy /></Page>} />
        <Route path="connexion" element={<Page><Auth /></Page>} />
        <Route path="compte" element={<Page><Account /></Page>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
