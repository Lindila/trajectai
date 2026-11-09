import { MODES, PRIORITIES } from '../lib/constants';

const TONES = {
  brand: { on: 'bg-brand-500 text-white border-brand-500', off: 'bg-brand-50 text-brand-700 border-brand-100' },
  cheap: { on: 'bg-cheap-500 text-white border-cheap-500', off: 'bg-cheap-50 text-cheap-600 border-cheap-50' },
  eco: { on: 'bg-brand-700 text-white border-brand-700', off: 'bg-eco-50 text-brand-700 border-brand-100' },
};

export function PriorityPicker({ value, onChange, compact = false }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Ma priorité">
      {Object.entries(PRIORITIES).map(([k, p]) => {
        const Icon = p.icon;
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(k)}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 px-2 font-semibold transition ${compact ? 'py-2 text-xs' : 'py-3.5 text-[13px]'} ${
              on ? `${TONES[p.tone].on} shadow-card` : `${TONES[p.tone].off} hover:brightness-95`
            }`}
          >
            <Icon size={compact ? 16 : 20} />
            {compact ? p.short : p.label}
          </button>
        );
      })}
    </div>
  );
}

export function ModePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Mode de transport">
      {Object.entries(MODES).map(([k, m]) => {
        const Icon = m.icon;
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(k)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-xs font-semibold transition ${
              on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:border-brand-400 hover:text-ink'
            }`}
          >
            <Icon size={19} />
            {m.short}
          </button>
        );
      })}
    </div>
  );
}
