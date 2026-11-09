import { useEffect, useId, useRef, useState } from 'react';
import { Clock3, Crosshair, Loader2, ScanSearch, Search, Star } from 'lucide-react';
import { api } from '../lib/api';
import { CATEGORIES } from '../lib/constants';
import { memoryOn, recentPlaces, rememberPlace, setMemoryOn } from '../lib/memory';
import CameraLocate from './CameraLocate';

const fmtDist = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);

function useMemoryState() {
  const [state, setState] = useState(() => ({ on: memoryOn(), recents: recentPlaces() }));
  useEffect(() => {
    const sync = () => setState({ on: memoryOn(), recents: recentPlaces() });
    window.addEventListener('traject:memory', sync);
    return () => window.removeEventListener('traject:memory', sync);
  }, []);
  return state;
}

// `near` : point autour duquel chercher en priorité (le départ de la journée, par exemple).
export default function PlaceSearch({ onSelect, placeholder = 'Rechercher un lieu ou une adresse', allowLocate = false, favorites = [], autoFocus = false, near }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [camera, setCamera] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState(null);
  const listId = useId();
  const boxRef = useRef(null);
  const memory = useMemoryState();
  const nearKey = near ? `${near.lat.toFixed(4)},${near.lon.toFixed(4)}` : '';

  const showRecents = open && q.trim().length < 3;
  const items = showRecents ? memory.recents : results;

  useEffect(() => {
    if (q.trim().length < 3) {
      setResults([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const { results: r } = await api.geocode(q, ctrl.signal, near);
        setResults(r);
        setActive(-1);
        setError(null);
      } catch (e) {
        if (e.name !== 'AbortError') setError('Recherche indisponible pour le moment.');
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, nearKey]);

  useEffect(() => {
    const close = (e) => !boxRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const choose = (place) => {
    rememberPlace(place);
    onSelect(place);
    setQ('');
    setResults([]);
    setOpen(false);
    setCamera(false);
  };

  // Position ponctuelle, demandée une seule fois, jamais suivie ni envoyée ailleurs qu'au géocodeur inverse.
  const locate = () => {
    if (!navigator.geolocation) return setError('Votre navigateur ne permet pas la localisation.');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const r = await api.reverse(latitude, longitude).catch(() => ({ label: 'Ma position' }));
        setLocating(false);
        choose({ label: r.label || 'Ma position', lat: latitude, lon: longitude, category: 'autre' });
      },
      () => {
        setLocating(false);
        setError('Localisation refusée : saisissez votre adresse ou utilisez la caméra.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onKey = (e) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === 'Escape') setOpen(false);
  };

  const iconBtn = 'flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-700';

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder}
          className={`input !pl-11 ${allowLocate ? '!pr-24' : '!pr-14'}`}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
        />
        <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center">
          {loading && <Loader2 size={18} className="mr-2 animate-spin text-muted" />}
          <button type="button" onClick={() => setCamera(true)} className={iconBtn} aria-label="Où suis-je ? Filmer la rue" title="Où suis-je ? Filmer la rue">
            <ScanSearch size={18} />
          </button>
          {allowLocate && (
            <button type="button" onClick={locate} className={iconBtn} aria-label="Utiliser ma position actuelle" title="Utiliser ma position (une seule fois)">
              {locating ? <Loader2 size={18} className="animate-spin" /> : <Crosshair size={18} />}
            </button>
          )}
        </div>
      </div>

      {favorites.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {favorites.map((f) => (
            <button key={`${f.label}-${f.lat}`} type="button" onClick={() => choose(f)} className="chip border border-line bg-white text-ink hover:border-brand-400">
              <Star size={12} className="text-cheap-500" /> {f.name || f.label}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {open && (items.length > 0 || (showRecents && !memory.on)) && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-[1500] overflow-hidden rounded-2xl border border-line bg-white shadow-float">
          {showRecents && items.length > 0 && <p className="px-4 pt-3 text-[11px] font-bold tracking-wider text-muted uppercase">Adresses récentes</p>}
          {items.length > 0 && (
            <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto p-1.5">
              {items.map((r, i) => {
                const cat = CATEGORIES[r.category] || CATEGORIES.autre;
                const Icon = showRecents ? Clock3 : cat.icon;
                return (
                  <li key={`${r.lat}-${r.lon}-${i}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onClick={() => choose(r)}
                      onMouseEnter={() => setActive(i)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${i === active ? 'bg-brand-50' : ''}`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${cat.color}1a`, color: cat.color }}>
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.label}</span>
                        <span className="block truncate text-xs text-muted">{r.sub}</span>
                      </span>
                      {r.distanceM != null && <span className="shrink-0 text-xs font-semibold text-brand-700">{fmtDist(r.distanceM)}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {showRecents && !memory.on && (
            <div className="flex items-center gap-3 border-t border-line bg-canvas px-4 py-3 text-xs text-muted">
              <Clock3 size={16} className="shrink-0" />
              <span className="flex-1">Retrouver vos adresses récentes ? Elles resteront uniquement sur cet appareil.</span>
              <button type="button" onClick={() => setMemoryOn(true)} className="chip shrink-0 bg-ink text-white">
                Activer
              </button>
            </div>
          )}
        </div>
      )}

      {camera && <CameraLocate near={near} onSelect={choose} onClose={() => setCamera(false)} />}
    </div>
  );
}
