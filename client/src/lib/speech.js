// Voix de l'assistant : Web Speech API du navigateur (gratuite, traitée sur l'appareil ou par le navigateur).

let cachedVoice = null;

function frenchVoice() {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis?.getVoices() || [];
  const fr = voices.filter((v) => v.lang?.toLowerCase().startsWith('fr'));
  cachedVoice =
    fr.find((v) => /google|natural|neural|online/i.test(v.name)) || fr.find((v) => /denise|amélie|thomas|julie/i.test(v.name)) || fr[0] || null;
  return cachedVoice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    frenchVoice();
  };
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export function speak(text, { onEnd } = {}) {
  if (!canSpeak() || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR';
  u.rate = 1.03;
  const voice = frenchVoice();
  if (voice) u.voice = voice;
  if (onEnd) u.onend = onEnd;
  window.speechSynthesis.speak(u);
}

export const stopSpeaking = () => canSpeak() && window.speechSynthesis.cancel();

export const getRecognition = () => {
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!SR) return null;
  const r = new SR();
  r.lang = 'fr-FR';
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  return r;
};

export const canListen = () => typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

// Préférence « voix activée » : réglage d'interface local à l'appareil.
const VOICE_KEY = 'trajectai-voice';
export function voiceOn() {
  try {
    return localStorage.getItem(VOICE_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function setVoiceOn(on) {
  try {
    localStorage.setItem(VOICE_KEY, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
  if (!on) stopSpeaking();
  window.dispatchEvent(new CustomEvent('traject:voice', { detail: on }));
}

// Ouvre l'assistant depuis n'importe quel composant, avec une question éventuelle.
export const openAssistant = (question) => window.dispatchEvent(new CustomEvent('traject:open', { detail: question }));
