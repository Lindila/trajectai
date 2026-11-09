// État du trajet : conservé uniquement en mémoire (aucun localStorage, aucune base).
// Fermer l'onglet ou cliquer sur « Effacer » supprime définitivement la journée.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { CATEGORIES, DEMO_DAY, MODES, PRIORITIES } from '../lib/constants';
import { saveTrip } from '../lib/memory';

const TripContext = createContext(null);

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nextQuarter = () => {
  const d = new Date(Date.now() + 15 * 60000);
  return `${String(d.getHours()).padStart(2, '0')}:${String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0')}`;
};

const initialForm = () => ({
  start: null,
  stops: [],
  date: today(),
  time: nextQuarter(),
  mode: 'transit',
  priority: 'time',
  returnToStart: true,
});

const SAVINGS_KEY = 'trajectai-savings';

// Compteur mensuel : uniquement des totaux agrégés, jamais de lieu ni d'horaire.
export function readSavings() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVINGS_KEY) || 'null');
    const month = new Date().toISOString().slice(0, 7);
    if (!s || s.month !== month) return { month, minutes: 0, euros: 0, co2: 0, trips: 0 };
    return s;
  } catch {
    return { month: new Date().toISOString().slice(0, 7), minutes: 0, euros: 0, co2: 0, trips: 0 };
  }
}
function addSavings(g) {
  try {
    const s = readSavings();
    const next = {
      ...s,
      minutes: s.minutes + Math.max(0, g.minutes || 0),
      euros: Math.round((s.euros + Math.max(0, g.euros || 0)) * 100) / 100,
      co2: Math.round((s.co2 + Math.max(0, g.co2 || 0)) * 100) / 100,
      trips: s.trips + 1,
    };
    localStorage.setItem(SAVINGS_KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : on ignore */
  }
}

export function TripProvider({ children }) {
  const [form, setFormState] = useState(initialForm);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [guidance, setGuidance] = useState(null);
  const formRef = useRef(form);
  const touched = useRef(false);

  const setForm = useCallback((patch) => {
    touched.current = true;
    setFormState((f) => {
      const next = { ...f, ...(typeof patch === 'function' ? patch(f) : patch) };
      formRef.current = next;
      return next;
    });
  }, []);

  const applyDefaults = useCallback(
    (prefs) => {
      if (touched.current || !prefs) return;
      setFormState((f) => {
        const next = { ...f, mode: prefs.default_mode || f.mode, priority: prefs.default_priority || f.priority };
        formRef.current = next;
        return next;
      });
    },
    [],
  );

  const addStop = useCallback(
    (place) =>
      setForm((f) =>
        f.stops.length >= 6
          ? {}
          : {
              stops: [
                ...f.stops,
                {
                  id: uid(),
                  label: place.label,
                  sub: place.sub || '',
                  lat: place.lat,
                  lon: place.lon,
                  category: place.category || 'autre',
                  constraint: place.constraint || { type: 'none' },
                  ...(place.items?.length ? { items: place.items } : {}),
                  ...(place.duration != null ? { duration: place.duration } : {}),
                },
              ],
            },
      ),
    [setForm],
  );
  const updateStop = useCallback(
    (id, patch) => setForm((f) => ({ stops: f.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)) })),
    [setForm],
  );
  const removeStop = useCallback((id) => setForm((f) => ({ stops: f.stops.filter((s) => s.id !== id) })), [setForm]);
  const moveStop = useCallback(
    (id, dir) =>
      setForm((f) => {
        const i = f.stops.findIndex((s) => s.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= f.stops.length) return {};
        const stops = [...f.stops];
        [stops[i], stops[j]] = [stops[j], stops[i]];
        return { stops };
      }),
    [setForm],
  );

  const optimize = useCallback(async (overrides = {}) => {
    const { order, ...formPatch } = overrides;
    const f = { ...formRef.current, ...formPatch };
    if (Object.keys(formPatch).length) {
      formRef.current = f;
      setFormState(f);
    }
    if (!f.start) throw new Error('Indiquez votre point de départ.');
    if (f.stops.length < 2) throw new Error('Ajoutez au moins 2 étapes.');
    setLoading(true);
    setError(null);
    try {
      const body = {
        start: { label: f.start.label, lat: f.start.lat, lon: f.start.lon },
        departure: `${f.date}T${f.time}`,
        mode: f.mode,
        priority: f.priority,
        returnToStart: f.returnToStart,
        stops: f.stops.map((s) => ({
          id: s.id,
          label: s.label,
          lat: s.lat,
          lon: s.lon,
          category: s.category,
          ...(s.duration != null && s.duration !== '' ? { duration: Number(s.duration) } : {}),
          constraint: s.constraint?.type && s.constraint.type !== 'none' ? s.constraint : { type: 'none' },
          ...(s.items?.length ? { items: s.items } : {}),
        })),
        ...(order ? { order } : {}),
      };
      const res = await api.optimize(body);
      setResult({ ...res, requestedAt: Date.now(), startPlace: f.start, returnToStart: f.returnToStart });
      setGuidance(null);
      saveTrip(f, res);
      return res;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  // Relance un trajet de l'historique pour aujourd'hui, avec le même départ et les mêmes étapes.
  const loadTrip = useCallback(
    async (entry) => {
      const f = {
        ...formRef.current,
        start: entry.start,
        stops: entry.stops.map((s) => ({ ...s, id: uid(), constraint: s.constraint || { type: 'none' } })),
        date: today(),
        time: entry.time,
        mode: entry.mode,
        priority: entry.priority,
        returnToStart: entry.returnToStart ?? true,
      };
      touched.current = true;
      formRef.current = f;
      setFormState(f);
      return optimize();
    },
    [optimize],
  );

  // Étapes dictées à l'assistant : chaque lieu est cherché près du départ (ou de Paris), puis ajouté.
  const addStopsFromAI = useCallback(
    async (list) => {
      const near = formRef.current.start || undefined;
      const added = [];
      for (const s of list) {
        if (formRef.current.stops.length + added.length >= 6) break;
        try {
          // « les courses » : on cherche le supermarché le plus proche, pas un commerce nommé « Courses ».
          const query = s.category === 'supermarche' && /^(faire )?(les |des )?courses$/i.test(s.query.trim()) ? 'supermarché' : s.query;
          const { results } = await api.geocode(query, undefined, near);
          const r = results?.[0];
          if (!r) continue;
          added.push({
            id: uid(),
            label: r.label,
            sub: r.sub || '',
            lat: r.lat,
            lon: r.lon,
            category: s.category && s.category !== 'autre' ? s.category : r.category || 'autre',
            constraint: s.constraint || { type: 'none' },
            ...(s.items?.length ? { items: s.items } : {}),
          });
        } catch {
          /* lieu introuvable : on passe au suivant */
        }
      }
      if (added.length) setForm((f) => ({ stops: [...f.stops, ...added].slice(0, 6) }));
      return added;
    },
    [setForm],
  );

  const loadDemo = useCallback(() => {
    setForm({
      start: DEMO_DAY.start,
      stops: DEMO_DAY.stops.map((s) => ({ ...s, id: uid(), constraint: s.constraint || { type: 'none' } })),
      time: DEMO_DAY.time,
    });
  }, [setForm]);

  const clearTrip = useCallback(() => {
    touched.current = false;
    const f = initialForm();
    formRef.current = f;
    setFormState(f);
    setResult(null);
    setGuidance(null);
    setError(null);
  }, []);

  // Guidage : index = étape visée (steps.length = retour au départ).
  const startGuidance = useCallback(() => setGuidance({ index: 0, startedAt: Date.now(), done: false }), []);
  const stopGuidance = useCallback(() => setGuidance(null), []);
  const arrive = useCallback(() => {
    setGuidance((g) => {
      if (!g || g.done || !result) return g;
      const last = result.plan.steps.length + (result.returnToStart ? 0 : -1);
      if (g.index >= last) return { ...g, done: true };
      return { ...g, index: g.index + 1 };
    });
  }, [result]);

  const counted = useRef(null);
  useEffect(() => {
    if (guidance?.done && result && counted.current !== guidance.startedAt) {
      counted.current = guidance.startedAt;
      if (!result.manual) addSavings(result.gains);
    }
  }, [guidance, result]);

  // Résumé transmis à l'assistant IA (jamais stocké côté serveur).
  const assistantContext = useMemo(() => {
    if (!result) {
      return {
        draft: {
          start: form.start?.label,
          stops: form.stops.map((s) => s.label),
        },
      };
    }
    return {
      mode: result.mode,
      modeLabel: MODES[result.mode].label,
      priority: result.priority,
      priorityLabel: PRIORITIES[result.priority].label,
      totals: result.plan.totals,
      endTime: result.plan.totals.endTime,
      summary: result.summary,
      steps: result.plan.steps.map((s) => ({
        label: s.label,
        categoryLabel: CATEGORIES[s.category]?.label,
        arrival: s.arrival,
        queueMin: s.queueMin,
        explanation: s.explanation,
      })),
      weather: result.weather ? { summary: result.weather.summary, min: result.weather.min, max: result.weather.max, recommended: result.weather.recommended } : undefined,
    };
  }, [result, form.start, form.stops]);

  const value = {
    form,
    setForm,
    applyDefaults,
    addStop,
    updateStop,
    removeStop,
    moveStop,
    optimize,
    loadDemo,
    loadTrip,
    addStopsFromAI,
    clearTrip,
    result,
    loading,
    error,
    setError,
    guidance,
    startGuidance,
    stopGuidance,
    arrive,
    assistantContext,
  };
  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export const useTrip = () => useContext(TripContext);
