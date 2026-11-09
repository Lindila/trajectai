import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Bike, Car, Clock, Database, ExternalLink, Leaf, Loader2, RefreshCw, Sunrise } from 'lucide-react';
import { api } from '../lib/api';
import { fmtNum } from '../lib/constants';

// Palette de données (validée CVD) : bleu = série principale, orange = comparaison.
const C = {
  s1: '#2a78d6',
  s2: '#eb6834',
  grid: '#e8edf4',
  axis: '#5b6785',
  eco: '#1aa86c',
  seq: ['#eef5fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
};
const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const todayIndex = (new Date().getDay() + 6) % 7;

function ChartCard({ title, subtitle, source, children, table, className = '' }) {
  return (
    <section className={`card flex min-w-0 flex-col p-5 sm:p-6 ${className}`}>
      <h2 className="text-lg font-extrabold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4 flex-1">{children}</div>
      {table && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-muted">Voir les données sous forme de tableau</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-line">{table}</div>
        </details>
      )}
      {source && (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
          <Database size={12} /> {source}
        </p>
      )}
    </section>
  );
}

function Tip({ active, payload, label, unit = '', labelFmt = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-float">
      <p className="mb-1 font-bold text-ink">{labelFmt(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-ink">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-muted">{p.name}</span>
          <strong className="ml-auto pl-3">
            {fmtNum(Math.round(p.value * 10) / 10)}
            {unit}
          </strong>
        </p>
      ))}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className="card p-4 sm:p-5">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={20} />
      </span>
      <p className="mt-3 text-2xl font-extrabold tracking-tight">{value}</p>
      <p className="text-sm font-semibold">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const Legend = ({ items }) => (
  <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
    {items.map(([color, label, dashed]) => (
      <span key={label} className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-5 rounded" style={{ background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 4px, transparent 4px 7px)` : color, height: 3 }} />
        {label}
      </span>
    ))}
  </div>
);

export default function Dashboard() {
  const [traffic, setTraffic] = useState(null);
  const [velib, setVelib] = useState(null);
  const [co2, setCo2] = useState(null);
  const [day, setDay] = useState(todayIndex);
  const [km, setKm] = useState(5);
  const [hover, setHover] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadVelib = () => {
    setRefreshing(true);
    api
      .velib()
      .then(setVelib)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    Promise.all([api.traffic(), api.co2()])
      .then(([t, c]) => {
        setTraffic(t);
        setCo2(c);
      })
      .catch(() => setError('Impossible de charger les données de la ville. Vérifiez que le serveur API est lancé.'));
    loadVelib();
  }, []);

  const hourly = useMemo(() => {
    if (!traffic) return [];
    return Array.from({ length: 24 }, (_, h) => ({
      h,
      jour: traffic.days[day][h].q,
      moyenne: Math.round(traffic.days.reduce((s, d) => s + d[h].q, 0) / 7),
    }));
  }, [traffic, day]);

  const kpis = useMemo(() => {
    if (!traffic) return null;
    const weekdays = traffic.days.slice(0, 5);
    const avgK = Array.from({ length: 24 }, (_, h) => weekdays.reduce((s, d) => s + d[h].k, 0) / 5);
    const daytime = avgK.map((k, h) => ({ k, h })).filter((x) => x.h >= 7 && x.h <= 20);
    const peak = daytime.reduce((a, b) => (b.k > a.k ? b : a));
    const calm = daytime.reduce((a, b) => (b.k < a.k ? b : a));
    return { peak, calm, gain: Math.round((1 - calm.k / peak.k) * 100) };
  }, [traffic]);

  const kRange = useMemo(() => {
    if (!traffic) return [0, 1];
    const all = traffic.days.flat().map((c) => c.k);
    return [Math.min(...all), Math.max(...all)];
  }, [traffic]);
  const shade = (k) => C.seq[Math.min(C.seq.length - 1, Math.floor(((k - kRange[0]) / (kRange[1] - kRange[0] || 1)) * C.seq.length))];

  const velibTotals = useMemo(() => {
    if (!velib) return null;
    return velib.zones.reduce((a, z) => ({ mechanical: a.mechanical + z.mechanical, ebike: a.ebike + z.ebike, docks: a.docks + z.docks }), {
      mechanical: 0,
      ebike: 0,
      docks: 0,
    });
  }, [velib]);

  const co2Data = useMemo(
    () => (co2 ? co2.modes.map((m) => ({ label: m.label, kg: Math.round(m.kgPerKm * km * 1000) / 1000 })).sort((a, b) => b.kg - a.kg) : []),
    [co2, km],
  );
  const carVsBike = co2 ? Math.round(co2.modes.find((m) => m.id === 'car').kgPerKm * km * 1000) : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 max-w-3xl animate-fade-up">
        <span className="chip bg-brand-50 text-brand-700">Données ouvertes · Ville de Paris</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">La mobilité de ma ville</h1>
        <p className="mt-3 text-muted">
          Les données qui alimentent l'IA de TrajectAI, rendues lisibles pour tous : quand circuler, où trouver un vélo, et quel mode pollue le moins.
        </p>
      </header>

      {error && <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* KPI */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi
          icon={Car}
          tone="bg-red-50 text-red-600"
          label="Heure la plus chargée"
          value={kpis ? `${kpis.peak.h}h` : '…'}
          hint="En semaine, entre 7h et 20h"
        />
        <Kpi
          icon={Sunrise}
          tone="bg-brand-50 text-brand-700"
          label="Heure la plus fluide"
          value={kpis ? `${kpis.calm.h}h` : '…'}
          hint={kpis ? `${kpis.gain} % d'occupation en moins qu'au pic` : ''}
        />
        <Kpi
          icon={Bike}
          tone="bg-blue-50 text-blue-700"
          label="Vélib' disponibles"
          value={velibTotals ? fmtNum(velibTotals.mechanical + velibTotals.ebike) : '…'}
          hint="En ce moment, dans Paris"
        />
        <Kpi icon={Leaf} tone="bg-brand-50 text-brand-700" label={`CO₂ évité en vélo sur ${km} km`} value={co2 ? `${fmtNum(carVsBike)} g` : '…'} hint="Par rapport à une voiture thermique" />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        {/* 1. Trafic par heure */}
        <ChartCard
          className="lg:col-span-2"
          title="Trafic moyen heure par heure"
          subtitle="Nombre moyen de véhicules par heure et par capteur routier. Comparez un jour à la moyenne de la semaine."
          source={traffic && `${traffic.source} · ${traffic.period?.from?.slice(0, 10)} → ${traffic.period?.to?.slice(0, 10)} · licence ${traffic.license}`}
          table={
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-canvas text-muted">
                <tr>
                  <th className="px-3 py-2">Heure</th>
                  <th className="px-3 py-2">{DAYS[day]}</th>
                  <th className="px-3 py-2">Moyenne semaine</th>
                </tr>
              </thead>
              <tbody>
                {hourly.map((r) => (
                  <tr key={r.h} className="border-t border-line">
                    <td className="px-3 py-1.5">{r.h}h</td>
                    <td className="px-3 py-1.5">{fmtNum(r.jour)}</td>
                    <td className="px-3 py-1.5">{fmtNum(r.moyenne)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Jour de la semaine">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={day === i}
                onClick={() => setDay(i)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${day === i ? 'bg-ink text-white' : 'bg-canvas text-muted hover:text-ink'}`}
              >
                <span className="sm:hidden">{d.slice(0, 3)}</span>
                <span className="hidden sm:inline">{d}</span>
              </button>
            ))}
          </div>
          <Legend items={[[C.s1, DAYS[day]], [C.s2, 'Moyenne de la semaine', true]]} />
          <div className="h-64 sm:h-72">
            {traffic ? (
              <ResponsiveContainer>
                <AreaChart data={hourly} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gJour" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={C.s1} stopOpacity={0.25} />
                      <stop offset="1" stopColor={C.s1} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="h" tickFormatter={(h) => `${h}h`} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} interval={2} />
                  <YAxis tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                  <Tooltip content={<Tip unit=" véh/h" labelFmt={(h) => `${DAYS[day]}, ${h}h`} />} cursor={{ stroke: C.axis, strokeDasharray: '3 3' }} />
                  <Area type="monotone" dataKey="jour" name={DAYS[day]} stroke={C.s1} strokeWidth={2} fill="url(#gJour)" activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                  <Line type="monotone" dataKey="moyenne" name="Moyenne semaine" stroke={C.s2} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton />
            )}
          </div>
        </ChartCard>

        {/* 2. Heatmap */}
        <ChartCard
          title="Quand la ville est-elle saturée ?"
          subtitle="Taux d'occupation moyen des routes (%), par jour et par heure. Plus c'est foncé, plus ça bouchonne."
          source={traffic && `${traffic.source} · heure de Paris`}
        >
          {traffic ? (
            <div>
              <div className="grid gap-[2px]" style={{ gridTemplateColumns: '34px repeat(24, minmax(0, 1fr))' }} onMouseLeave={() => setHover(null)}>
                {traffic.days.map((hours, d) => (
                  <div key={d} className="contents">
                    <span className="self-center text-[10px] font-semibold text-muted">{DAYS[d].slice(0, 3)}</span>
                    {hours.map((c, h) => (
                      <span
                        key={h}
                        onMouseEnter={() => setHover({ d, h, k: c.k })}
                        onClick={() => setHover({ d, h, k: c.k })}
                        className={`aspect-square rounded-[3px] ${hover?.d === d && hover?.h === h ? 'ring-2 ring-ink ring-offset-1' : ''}`}
                        style={{ background: shade(c.k) }}
                        title={`${DAYS[d]} ${h}h : ${c.k.toFixed(1).replace('.', ',')} %`}
                      />
                    ))}
                  </div>
                ))}
                <span />
                {Array.from({ length: 24 }, (_, h) => (
                  <span key={h} className="text-center text-[9px] text-muted">
                    {h % 6 === 0 ? `${h}h` : ''}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-muted">
                  Fluide
                  <span className="flex">
                    {C.seq.map((c) => (
                      <span key={c} className="h-3 w-5" style={{ background: c }} />
                    ))}
                  </span>
                  Saturé
                </div>
                <p className="min-h-5 text-xs font-semibold" aria-live="polite">
                  {hover ? `${DAYS[hover.d]} ${hover.h}h : ${hover.k.toFixed(1).replace('.', ',')} % d'occupation` : 'Survolez une case'}
                </p>
              </div>
              {kpis && (
                <div className="mt-5 rounded-2xl bg-canvas p-4 text-sm">
                  <p className="font-bold">À retenir</p>
                  <ul className="mt-2 space-y-1.5 text-muted">
                    <li>• En semaine, les routes sont les plus chargées vers <strong className="text-ink">{kpis.peak.h}h</strong>.</li>
                    <li>• Partir vers <strong className="text-ink">{kpis.calm.h}h</strong>, c'est {kpis.gain} % d'occupation en moins.</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <Skeleton h="h-56" />
          )}
        </ChartCard>

        {/* 3. CO2 */}
        <ChartCard
          title="Combien émet mon trajet ?"
          subtitle="Émissions en kg CO₂e pour la distance choisie, par voyageur."
          source={co2 && `${co2.source}`}
          table={
            <table className="w-full text-left text-xs">
              <tbody>
                {co2Data.map((r) => (
                  <tr key={r.label} className="border-t border-line first:border-0">
                    <td className="px-3 py-1.5">{r.label}</td>
                    <td className="px-3 py-1.5 text-right">{r.kg.toFixed(3).replace('.', ',')} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <label className="mb-3 flex items-center gap-3 text-sm font-semibold">
            <span className="shrink-0">Distance : {km} km</span>
            <input type="range" min="1" max="30" value={km} onChange={(e) => setKm(Number(e.target.value))} className="w-full accent-[#1aa86c]" />
          </label>
          <div className="h-80">
            {co2 ? (
              <ResponsiveContainer>
                <BarChart data={co2Data} layout="vertical" margin={{ top: 0, right: 56, left: 0, bottom: 0 }} barCategoryGap={4}>
                  <CartesianGrid horizontal={false} stroke={C.grid} />
                  <XAxis type="number" tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" width={118} tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tip unit=" kg" />} cursor={{ fill: 'rgba(15,27,61,.04)' }} />
                  <Bar dataKey="kg" name="CO₂" fill={C.eco} radius={[0, 4, 4, 0]} maxBarSize={18}>
                    <LabelList dataKey="kg" position="right" formatter={(v) => (v > 0 ? `${v.toFixed(2).replace('.', ',')}` : '0')} style={{ fill: C.axis, fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton />
            )}
          </div>
        </ChartCard>

        {/* 4. Vélib */}
        <ChartCard
          className="lg:col-span-2"
          title="Vélib' disponibles en ce moment"
          subtitle="Vélos mécaniques et électriques disponibles par arrondissement, en temps réel."
          source={velib && `${velib.source} · mis à jour à ${new Date(velib.fetchedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · licence ${velib.license}`}
          table={
            velib && (
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-canvas text-muted">
                  <tr>
                    <th className="px-3 py-2">Arrondissement</th>
                    <th className="px-3 py-2">Mécaniques</th>
                    <th className="px-3 py-2">Électriques</th>
                    <th className="px-3 py-2">Places libres</th>
                    <th className="px-3 py-2">Stations</th>
                  </tr>
                </thead>
                <tbody>
                  {velib.zones.map((z) => (
                    <tr key={z.zone} className="border-t border-line">
                      <td className="px-3 py-1.5">{z.zone}</td>
                      <td className="px-3 py-1.5">{z.mechanical}</td>
                      <td className="px-3 py-1.5">{z.ebike}</td>
                      <td className="px-3 py-1.5">{z.docks}</td>
                      <td className="px-3 py-1.5">{z.stations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ background: C.s1 }} /> Mécaniques
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ background: C.s2 }} /> Électriques
              </span>
            </div>
            <button type="button" onClick={loadVelib} className="chip border border-line bg-white text-muted hover:text-ink" disabled={refreshing}>
              {refreshing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Actualiser
            </button>
          </div>
          <div className="h-72">
            {velib ? (
              <ResponsiveContainer>
                <BarChart data={velib.zones} margin={{ top: 8, right: 4, left: -16, bottom: 0 }} barCategoryGap="18%">
                  <CartesianGrid vertical={false} stroke={C.grid} />
                  <XAxis dataKey="zone" tick={{ fill: C.axis, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis tick={{ fill: C.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<Tip unit=" vélos" labelFmt={(z) => `Paris ${z}`} />} cursor={{ fill: 'rgba(15,27,61,.04)' }} />
                  <Bar dataKey="mechanical" name="Mécaniques" stackId="v" fill={C.s1} stroke="#fff" strokeWidth={1} />
                  <Bar dataKey="ebike" name="Électriques" stackId="v" fill={C.s2} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Skeleton />
            )}
          </div>
        </ChartCard>
      </div>

      <section className="card mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
          <Clock size={22} />
        </span>
        <div className="flex-1">
          <p className="font-extrabold">Ces données servent directement votre trajet</p>
          <p className="text-sm text-muted">
            Le taux d'occupation des routes ajuste les temps de trajet en voiture et en bus selon l'heure. Les facteurs ADEME calculent le CO₂ de chaque option.
          </p>
        </div>
        <a href="https://opendata.paris.fr" target="_blank" rel="noreferrer" className="btn-ghost shrink-0 !py-2.5 text-sm">
          opendata.paris.fr <ExternalLink size={14} />
        </a>
      </section>
    </div>
  );
}

function Skeleton({ h = 'h-full' }) {
  return <div className={`${h} w-full animate-pulse rounded-xl bg-canvas`} />;
}
