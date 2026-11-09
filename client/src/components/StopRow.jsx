import { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, ShoppingBasket, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { CATEGORIES, shoppingMinutes } from '../lib/constants';

// Liste de courses : chaque article ajoute du temps sur place, ce qui affine le calcul.
function ShoppingList({ items = [], manualDuration, onChange }) {
  const [draft, setDraft] = useState('');
  const add = (text) => {
    const next = text.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
    if (next.length) onChange([...items, ...next].slice(0, 80));
    setDraft('');
  };
  return (
    <div className="border-t border-line px-3 py-3">
      <p className="flex items-center gap-2 text-xs font-bold text-ink">
        <ShoppingBasket size={15} className="text-[#16a34a]" /> Liste de courses
        {items.length > 0 && (
          <span className="chip !py-0.5 bg-brand-50 text-brand-700">
            {items.length} article{items.length > 1 ? 's' : ''} · ≈ {manualDuration ?? shoppingMinutes(items.length)} min sur place
          </span>
        )}
      </p>
      {items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <li key={`${it}-${i}`} className="chip border border-line bg-white !py-1 text-ink">
              {it}
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-muted hover:text-red-600" aria-label={`Retirer ${it}`}>
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        className="input mt-2 !py-2 text-sm"
        placeholder="Ajouter un article (ou plusieurs, séparés par des virgules)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => draft && add(draft)}
        aria-label="Ajouter un article à la liste de courses"
      />
      <p className="mt-1.5 text-[11px] text-muted">
        {manualDuration != null ? 'Vous avez fixé la durée sur place : elle remplace l’estimation.' : 'Estimation : 6 min + environ 1 min 20 par article, sans compter la file d’attente.'}
      </p>
    </div>
  );
}

export default function StopRow({ stop, index, total, onChange, onRemove, onMove }) {
  const [open, setOpen] = useState(false);
  const cat = CATEGORIES[stop.category] || CATEGORIES.autre;
  const Icon = cat.icon;
  const c = stop.constraint || { type: 'none' };
  const isShop = stop.category === 'supermarche';
  const nItems = stop.items?.length || 0;

  return (
    <li className="rounded-2xl border border-line bg-white transition hover:border-brand-100">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: `${cat.color}1a`, color: cat.color }}>
          <Icon size={19} />
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="block truncate text-[15px] font-semibold">{stop.label}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>{cat.label}</span>
            {nItems > 0 && (
              <span className="chip !px-2 !py-0.5 bg-brand-50 text-brand-700">
                <ShoppingBasket size={11} /> {nItems} article{nItems > 1 ? 's' : ''}
              </span>
            )}
            {c.type !== 'none' && c.time && (
              <span className="chip !px-2 !py-0.5 bg-cheap-50 text-cheap-600">
                <Clock size={11} /> {c.type === 'before' ? 'avant' : 'pas avant'} {c.time.replace(':', 'h')}
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center">
          {isShop && (
            <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-[#16a34a] hover:bg-brand-50" aria-label={`Liste de courses pour ${stop.label}`} title="Liste de courses">
              <ShoppingBasket size={17} />
            </button>
          )}
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="rounded-lg p-1.5 text-muted hover:bg-canvas disabled:opacity-25" aria-label={`Monter ${stop.label}`}>
            <ChevronUp size={18} />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="rounded-lg p-1.5 text-muted hover:bg-canvas disabled:opacity-25" aria-label={`Descendre ${stop.label}`}>
            <ChevronDown size={18} />
          </button>
          <button type="button" onClick={() => setOpen((o) => !o)} className={`rounded-lg p-1.5 hover:bg-canvas ${open ? 'text-brand-600' : 'text-muted'}`} aria-label={`Options de ${stop.label}`}>
            <SlidersHorizontal size={17} />
          </button>
          <button type="button" onClick={onRemove} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600" aria-label={`Supprimer ${stop.label}`}>
            <Trash2 size={17} />
          </button>
        </div>
      </div>

      {open && (
        <div className="grid gap-3 border-t border-line px-3 py-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted">
            Type de lieu
            <select className="input mt-1 !py-2 text-sm" value={stop.category} onChange={(e) => onChange({ category: e.target.value })}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-muted">
            Contrainte horaire
            <div className="mt-1 flex gap-2">
              <select
                className="input !py-2 text-sm"
                value={c.type}
                onChange={(e) => onChange({ constraint: { type: e.target.value, time: c.time || (e.target.value === 'before' ? '08:30' : '14:00') } })}
              >
                <option value="none">Aucune</option>
                <option value="before">Avant</option>
                <option value="after">Pas avant</option>
              </select>
              {c.type !== 'none' && (
                <input
                  type="time"
                  className="input !w-28 !py-2 text-sm"
                  value={c.time || ''}
                  onChange={(e) => onChange({ constraint: { ...c, time: e.target.value } })}
                  aria-label="Heure de la contrainte"
                />
              )}
            </div>
          </label>
          <label className="text-xs font-semibold text-muted">
            Durée sur place (min)
            <input
              type="number"
              min="0"
              max="480"
              step="5"
              className="input mt-1 !py-2 text-sm"
              placeholder="Auto"
              value={stop.duration ?? ''}
              onChange={(e) => onChange({ duration: e.target.value === '' ? null : Math.max(0, Math.min(480, Number(e.target.value))) })}
            />
          </label>
        </div>
      )}
      {open && isShop && <ShoppingList items={stop.items} manualDuration={stop.duration ?? null} onChange={(items) => onChange({ items })} />}
    </li>
  );
}
