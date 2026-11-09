import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Navigation, Sun, Umbrella } from 'lucide-react';
import { MODES } from '../lib/constants';

export const WEATHER_ICONS = { sun: Sun, 'cloud-sun': CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, snow: CloudSnow, storm: CloudLightning };

// Météo de la journée et mode conseillé par l'IA (priorité de l'usager + confort météo).
export default function WeatherCard({ weather, currentMode, onSwitch, loading }) {
  if (!weather) return null;
  const rec = weather.recommended;
  const RecIcon = MODES[rec.mode]?.icon || Navigation;
  const rainy = /Pluie/.test(weather.summary);
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 px-5 pt-5">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${rainy ? 'bg-blue-50 text-blue-700' : 'bg-cheap-50 text-cheap-600'}`}>
          {rainy ? <Umbrella size={20} /> : <Sun size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold">Météo de votre journée</h2>
          <p className="text-sm text-muted">
            {weather.summary} · {weather.min === weather.max ? `${weather.min} °C` : `${weather.min} à ${weather.max} °C`}
          </p>
        </div>
      </div>

      <ol className="mt-4 flex gap-1 overflow-x-auto px-5 pb-1" aria-label="Prévisions heure par heure">
        {weather.hours.map((h) => {
          const Icon = WEATHER_ICONS[h.icon] || Cloud;
          return (
            <li key={h.h} className="flex min-w-[52px] flex-col items-center gap-1 rounded-xl bg-canvas px-2 py-2 text-xs" title={`${h.label}, ${h.temp} °C, pluie ${h.pop} %`}>
              <span className="font-semibold text-muted">{h.h}h</span>
              <Icon size={18} className={h.pop >= 50 ? 'text-blue-600' : 'text-cheap-500'} />
              <span className="font-bold">{h.temp}°</span>
              <span className={`text-[10px] ${h.pop >= 50 ? 'font-bold text-blue-700' : 'text-muted'}`}>{h.pop} %</span>
            </li>
          );
        })}
      </ol>

      <div className="m-5 mt-4 flex items-start gap-3 rounded-2xl bg-ink p-4 text-white">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500">
          <RecIcon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-brand-400 uppercase">
            Conseil du jour
          </p>
          <p className="mt-0.5 text-sm leading-relaxed">{rec.reason}</p>
          {rec.mode !== currentMode && (
            <button type="button" disabled={loading} onClick={() => onSwitch(rec.mode)} className="btn-brand mt-3 !px-4 !py-2 text-sm">
              Passer en {MODES[rec.mode].label.toLowerCase()}
            </button>
          )}
        </div>
      </div>
      <p className="px-5 pb-4 text-[11px] text-muted">Prévisions : {weather.source}</p>
    </section>
  );
}
