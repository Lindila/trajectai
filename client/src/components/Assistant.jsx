// Traject, l'assistant IA : une orbe vocale pour parler directement, et un chat texte.
// Il répond à voix haute et peut agir dans l'application (priorité, mode, guidage, étapes dictées…).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Keyboard, MessageSquareText, Mic, MicOff, Send, Volume2, VolumeX, X } from 'lucide-react';
import { api } from '../lib/api';
import { canListen, getRecognition, setVoiceOn, speak, stopSpeaking, voiceOn } from '../lib/speech';
import { useTrip } from '../context/TripContext';

const PAGES = { planner: '/planifier', dashboard: '/ville', privacy: '/confidentialite', account: '/compte', history: '/mes-trajets' };
const PAGE_NAMES = {
  '/': 'accueil',
  '/planifier': 'planification',
  '/trajet': 'mon trajet',
  '/mes-trajets': 'mes trajets',
  '/ville': 'dashboard mobilité',
  '/confidentialite': 'confidentialité',
  '/compte': 'compte',
};

const WELCOME = {
  role: 'assistant',
  content:
    "Bonjour, je suis Traject ! Dites-moi simplement ce que vous avez à faire aujourd'hui, je crée les étapes et je calcule le meilleur ordre. Je réponds aussi à vos questions : pourquoi cet ordre, la météo, la prochaine étape…",
};

const STATE_LABEL = {
  idle: 'Touchez l’orbe et parlez',
  listening: 'Je vous écoute…',
  thinking: 'Je réfléchis…',
  speaking: 'Traject vous répond',
};

function Orb({ state, size = 'h-56 w-56', onClick, label }) {
  return (
    <button type="button" onClick={onClick} className={`relative ${size} shrink-0 rounded-full`} aria-label={label}>
      {state === 'listening' && (
        <>
          <span className="orb-ring absolute inset-0 rounded-full border-4 border-brand-400" />
          <span className="orb-ring absolute inset-0 rounded-full border-4 border-brand-400 [animation-delay:0.8s]" />
        </>
      )}
      <span className="orb absolute inset-0 overflow-hidden rounded-full" data-state={state} />
      <span className="absolute inset-0 flex items-center justify-center text-white">
        {state === 'listening' ? <Mic size={42} /> : <Mic size={38} className="opacity-90" />}
      </span>
    </button>
  );
}

export default function Assistant() {
  const [chatOpen, setChatOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [orbState, setOrbState] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voice, setVoice] = useState(voiceOn);
  const [engine, setEngine] = useState(null);
  const recRef = useRef(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const trip = useTrip();
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    api.assistantStatus().then(setEngine).catch(() => setEngine({ ai: false, model: 'hors ligne' }));
  }, []);

  useEffect(() => {
    const onVoice = (e) => setVoice(e.detail);
    window.addEventListener('traject:voice', onVoice);
    return () => window.removeEventListener('traject:voice', onVoice);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const say = useCallback((text) => {
    if (!voiceOn()) {
      setOrbState('idle');
      return;
    }
    setOrbState('speaking');
    speak(text, { onEnd: () => setOrbState('idle') });
  }, []);

  const addMessage = (content) => setMessages((m) => [...m, { role: 'assistant', content }]);

  const runAction = useCallback(
    async (action) => {
      const t = tripRef.current;
      if (!action || action.type === 'none') return;
      try {
        if (action.type === 'setPriority' && ['time', 'cost', 'co2'].includes(action.value)) {
          if (t.result) await t.optimize({ priority: action.value });
          else t.setForm({ priority: action.value });
        } else if (action.type === 'setMode' && ['car', 'transit', 'bike', 'walk'].includes(action.value)) {
          if (t.result) await t.optimize({ mode: action.value });
          else t.setForm({ mode: action.value });
        } else if (action.type === 'optimize') {
          await t.optimize();
          setVoiceOpen(false);
          navigate('/trajet');
        } else if (action.type === 'startGuidance') {
          if (t.result) {
            navigate('/trajet');
            t.startGuidance();
          } else navigate('/planifier');
        } else if (action.type === 'nextStep') {
          t.arrive();
        } else if (action.type === 'openPage' && PAGES[action.value]) {
          if (pathRef.current !== PAGES[action.value]) navigate(PAGES[action.value]);
        } else if (action.type === 'addStops' && Array.isArray(action.value)) {
          navigate('/planifier');
          const added = await t.addStopsFromAI(action.value);
          const missed = action.value.length - added.length;
          if (!added.length) {
            addMessage("Je n'ai trouvé aucun de ces lieux. Pouvez-vous préciser l'adresse ou le quartier ?");
            return;
          }
          if (missed > 0) addMessage(`J'ai ajouté ${added.length} étape(s) ; ${missed} lieu(x) introuvable(s), à préciser à la main.`);
          const f = tripRef.current.form;
          const total = f.stops.length + added.length;
          if (!f.start) {
            const msg = 'Étapes ajoutées ! Indiquez votre point de départ et je calcule le meilleur ordre.';
            addMessage(msg);
          } else if (total >= 2) {
            // Laisse React appliquer l'ajout, puis calcule directement l'ordre optimal.
            setTimeout(async () => {
              try {
                await tripRef.current.optimize();
                // On montre directement le trajet calculé ; la voix continue sa réponse.
                setVoiceOpen(false);
                navigate('/trajet');
              } catch (e) {
                addMessage(`Je n'ai pas pu calculer : ${e.message}`);
              }
            }, 50);
          }
        }
      } catch (e) {
        addMessage(`Je n'ai pas pu le faire : ${e.message}`);
      }
    },
    [navigate],
  );

  const send = useCallback(
    async (text) => {
      const content = text.trim();
      if (!content) return;
      stopSpeaking();
      const history = [...messagesRef.current, { role: 'user', content }];
      setMessages(history);
      setInput('');
      setBusy(true);
      setOrbState('thinking');
      try {
        const t = tripRef.current;
        const g =
          t.guidance && t.result && !t.guidance.done
            ? { index: t.guidance.index, total: t.result.plan.steps.length, next: t.result.plan.steps[t.guidance.index]?.label }
            : undefined;
        const c = t.assistantContext || {};
        const res = await api.assistant(history.filter((m) => m !== WELCOME).slice(-12), {
          page: PAGE_NAMES[pathRef.current] || pathRef.current,
          plan: c.steps ? c : undefined,
          draft: c.draft,
          weather: c.weather,
          guidance: g,
        });
        addMessage(res.reply);
        say(res.reply);
        runAction(res.action);
      } catch {
        const msg = "Désolé, je n'arrive pas à joindre le serveur. Réessayez dans un instant.";
        addMessage(msg);
        setOrbState('idle');
      } finally {
        setBusy(false);
      }
    },
    [runAction, say],
  );

  // Écoute vocale partagée par l'orbe et par le micro du chat.
  const listen = useCallback(
    (fromOrb) => {
      if (listening) {
        recRef.current?.stop();
        return;
      }
      const rec = getRecognition();
      if (!rec) return;
      stopSpeaking();
      recRef.current = rec;
      let finalText = '';
      setTranscript('');
      rec.onresult = (e) => {
        let interim = '';
        for (const r of e.results) {
          if (r.isFinal) finalText = r[0].transcript;
          else interim += r[0].transcript;
        }
        const shown = finalText || interim;
        if (fromOrb) setTranscript(shown);
        else setInput(shown);
      };
      rec.onend = () => {
        setListening(false);
        if (finalText) send(finalText);
        else setOrbState('idle');
      };
      rec.onerror = () => {
        setListening(false);
        setOrbState('idle');
      };
      setListening(true);
      setOrbState('listening');
      rec.start();
    },
    [listening, send],
  );

  useEffect(() => {
    const onOpen = (e) => {
      setChatOpen(true);
      setVoiceOpen(false);
      if (e.detail) send(e.detail);
      else setTimeout(() => inputRef.current?.focus(), 50);
    };
    const onVoiceOpen = () => {
      setChatOpen(false);
      setVoiceOpen(true);
      if (canListen()) setTimeout(() => listen(true), 250);
    };
    window.addEventListener('traject:open', onOpen);
    window.addEventListener('traject:voice-open', onVoiceOpen);
    return () => {
      window.removeEventListener('traject:open', onOpen);
      window.removeEventListener('traject:voice-open', onVoiceOpen);
    };
  }, [send, listen]);

  const closeVoice = () => {
    recRef.current?.abort?.();
    stopSpeaking();
    setVoiceOpen(false);
    setOrbState('idle');
  };

  const lastReply = [...messages].reverse().find((m) => m.role === 'assistant');
  const suggestions = trip.result
    ? ['Pourquoi cet ordre ?', 'Quel temps fera-t-il ?', 'Je veux polluer moins', "C'est parti !"]
    : ['Mairie, pharmacie et courses cet après-midi', 'Quand le trafic est-il le plus fluide ?', 'Gardez-vous mes trajets ?'];

  return (
    <>
      {/* Boutons flottants : orbe vocale (principale) et chat */}
      {!voiceOpen && !chatOpen && (
        <div className="fixed right-4 bottom-24 z-[1100] flex flex-col items-center gap-3 md:right-6 md:bottom-6">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-ink shadow-card hover:border-brand-400"
            aria-label="Écrire à Traject"
            title="Écrire à Traject"
          >
            <MessageSquareText size={19} />
          </button>
          <div className={`rounded-full ${trip.guidance && !trip.guidance.done ? 'animate-pulse-ring' : ''}`}>
            <Orb
              state="idle"
              size="h-16 w-16"
              label="Parler à Traject"
              onClick={() => window.dispatchEvent(new Event('traject:voice-open'))}
            />
          </div>
        </div>
      )}

      {/* Mode vocal plein écran */}
      {voiceOpen && (
        <section className="fixed inset-0 z-[1300] flex flex-col items-center bg-ink/95 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white backdrop-blur animate-fade-up" aria-label="Parler à Traject">
          <div className="flex w-full max-w-xl items-center justify-between">
            <div>
              <p className="font-extrabold">Traject</p>
              <p className="text-xs text-white/60">{engine?.ai ? `IA open source · ${engine.model}` : 'Mode local'}</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setVoiceOn(!voice);
                  setVoice(!voice);
                }}
                className="rounded-full p-2.5 hover:bg-white/10"
                aria-label={voice ? 'Couper la voix' : 'Activer la voix'}
              >
                {voice ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>
              <button type="button" onClick={closeVoice} className="rounded-full p-2.5 hover:bg-white/10" aria-label="Fermer">
                <X size={22} />
              </button>
            </div>
          </div>

          <div className="flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-8 text-center">
            <Orb state={orbState} onClick={() => (canListen() ? listen(true) : null)} label={listening ? "Arrêter l'écoute" : 'Parler'} />
            <p className="text-sm font-semibold tracking-wide text-brand-400" aria-live="polite">
              {STATE_LABEL[orbState]}
            </p>
            {transcript && <p className="text-xl font-semibold">« {transcript} »</p>}
            {lastReply && orbState !== 'listening' && lastReply !== WELCOME && <p className="max-w-md text-base leading-relaxed text-white/85">{lastReply.content}</p>}
            {!canListen() && <p className="text-sm text-white/60">La reconnaissance vocale n’est pas disponible sur ce navigateur (utilisez Chrome ou Edge) : écrivez votre demande.</p>}
          </div>

          <div className="w-full max-w-xl space-y-3">
            {(orbState === 'idle' || orbState === 'listening') && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="shrink-0 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                closeVoice();
                setChatOpen(true);
              }}
              className="mx-auto flex items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
            >
              <Keyboard size={16} /> Écrire plutôt
            </button>
          </div>
        </section>
      )}

      {/* Chat texte */}
      {chatOpen && (
        <section
          className="fixed inset-x-0 bottom-0 z-[1200] flex h-[82dvh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-float animate-fade-up sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[600px] sm:max-h-[calc(100dvh-8rem)] sm:w-[400px] sm:rounded-3xl"
          aria-label="Assistant Traject"
        >
          <header className="flex items-center gap-3 bg-ink px-5 py-4 text-white">
            <button
              type="button"
              onClick={() => {
                setChatOpen(false);
                window.dispatchEvent(new Event('traject:voice-open'));
              }}
              className="orb relative h-10 w-10 shrink-0 overflow-hidden rounded-full"
              aria-label="Passer en mode vocal"
              title="Parler à Traject"
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Traject</p>
              <p className="truncate text-xs text-white/65">{engine ? (engine.ai ? `IA open source · ${engine.model}` : `Mode local · ${engine.model}`) : 'Connexion…'}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setVoiceOn(!voice);
                setVoice(!voice);
              }}
              className="rounded-full p-2 hover:bg-white/10"
              aria-label={voice ? 'Couper la voix' : 'Activer la voix'}
            >
              {voice ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button type="button" onClick={() => setChatOpen(false)} className="rounded-full p-2 hover:bg-white/10" aria-label="Fermer">
              <X size={20} />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-canvas px-4 py-4" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <p
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed ${
                    m.role === 'user' ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md bg-white text-ink shadow-card'
                  }`}
                >
                  {m.content}
                </p>
              </div>
            ))}
            {busy && (
              <div className="flex w-fit gap-1 rounded-2xl bg-white px-4 py-3 shadow-card" aria-label="Traject réfléchit">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto border-t border-line px-4 pt-3 pb-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-brand-400 hover:text-brand-700"
              >
                {s}
              </button>
            ))}
          </div>

          <form
            className="flex items-center gap-2 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            {canListen() && (
              <button
                type="button"
                onClick={() => listen(false)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  listening ? 'animate-pulse-ring bg-red-500 text-white' : 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                }`}
                aria-label={listening ? "Arrêter l'écoute" : 'Parler à Traject'}
              >
                {listening ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={listening ? 'Je vous écoute…' : 'Décrivez votre journée ou posez une question…'}
              className="input !rounded-full !py-2.5"
              maxLength={500}
              aria-label="Votre message"
            />
            <button type="submit" disabled={!input.trim() || busy} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40" aria-label="Envoyer">
              <Send size={18} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
