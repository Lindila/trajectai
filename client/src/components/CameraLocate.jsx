// « Où suis-je ? » : on filme la rue, l'IA de vision lit plaques et enseignes et retrouve le lieu.
// L'image est envoyée une seule fois pour l'analyse, puis oubliée (aucun stockage).
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ImagePlus, Loader2, MapPin, ScanSearch, X } from 'lucide-react';
import { api } from '../lib/api';
import { CATEGORIES } from '../lib/constants';

const MAX_SIDE = 1024;

function toJpeg(source, width, height) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

export default function CameraLocate({ near, onSelect, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [camError, setCamError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCamError("Caméra indisponible : importez plutôt une photo de la rue."));
    if (!navigator.mediaDevices) setCamError('Caméra non prise en charge : importez une photo.');
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const analyse = async (dataUrl) => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.visionLocate(dataUrl, near);
      if (!r.query) setError("Je ne lis aucune plaque ni enseigne. Visez un panneau de rue, un numéro ou une devanture.");
      else setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v?.videoWidth) return;
    analyse(toJpeg(v, v.videoWidth, v.videoHeight));
  };

  const fromFile = (file) => {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      analyse(toJpeg(img, img.naturalWidth, img.naturalHeight));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  // Rendu au niveau du document : un parent animé (transform) piégerait sinon la fenêtre plein écran.
  return createPortal(
    <div className="fixed inset-0 z-[3000] flex flex-col bg-ink text-white" role="dialog" aria-modal="true" aria-label="Où suis-je ?">
      <header className="flex items-center gap-3 px-4 py-3">
        <ScanSearch size={22} className="text-brand-400" />
        <div className="flex-1">
          <p className="font-extrabold">Où suis-je ?</p>
          <p className="text-xs text-white/60">Filmez une plaque de rue, une enseigne ou un monument</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Fermer">
          <X size={22} />
        </button>
      </header>

      <div className="relative mx-4 flex-1 overflow-hidden rounded-3xl bg-black">
        {!camError ? (
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white/70">
            <Camera size={40} />
            <p className="text-sm">{camError}</p>
          </div>
        )}
        {/* Viseur */}
        {!camError && (
          <div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-white/40">
            <span className="absolute -top-0.5 -left-0.5 h-8 w-8 rounded-tl-3xl border-t-4 border-l-4 border-brand-400" />
            <span className="absolute -top-0.5 -right-0.5 h-8 w-8 rounded-tr-3xl border-t-4 border-r-4 border-brand-400" />
            <span className="absolute -bottom-0.5 -left-0.5 h-8 w-8 rounded-bl-3xl border-b-4 border-l-4 border-brand-400" />
            <span className="absolute -right-0.5 -bottom-0.5 h-8 w-8 rounded-br-3xl border-r-4 border-b-4 border-brand-400" />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/70 backdrop-blur-sm">
            <Loader2 size={36} className="animate-spin text-brand-400" />
            <p className="text-sm font-semibold">L’IA lit la rue…</p>
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {error && <p className="rounded-xl bg-white/10 px-4 py-3 text-sm">{error}</p>}
        {result && (
          <div className="rounded-2xl bg-white p-3 text-ink animate-fade-up">
            <p className="px-1 text-xs text-muted">
              Indices lus : {result.clues.join(' · ') || result.query} · confiance {Math.round(result.confidence * 100)} %
            </p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {result.results.map((r, i) => {
                const cat = CATEGORIES[r.category] || CATEGORIES.autre;
                return (
                  <li key={`${r.lat}-${i}`}>
                    <button
                      type="button"
                      onClick={() => onSelect(r)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-brand-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${cat.color}1a`, color: cat.color }}>
                        <MapPin size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.label}</span>
                        <span className="block truncate text-xs text-muted">
                          {r.sub}
                          {r.distanceM != null && ` · à ${r.distanceM < 1000 ? `${r.distanceM} m` : `${(r.distanceM / 1000).toFixed(1).replace('.', ',')} km`}`}
                        </span>
                      </span>
                      <span className="chip bg-brand-500 text-white">Choisir</span>
                    </button>
                  </li>
                );
              })}
              {!result.results.length && <li className="px-2 py-2 text-sm text-muted">« {result.query} » : aucun lieu correspondant trouvé.</li>}
            </ul>
          </div>
        )}
        <div className="flex items-center justify-center gap-6">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Importer une photo"
          >
            <ImagePlus size={22} />
          </button>
          <button
            type="button"
            onClick={capture}
            disabled={busy || Boolean(camError)}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-brand-500 shadow-float transition active:scale-95 disabled:opacity-40"
            aria-label="Analyser l'image"
          >
            <ScanSearch size={30} />
          </button>
          <span className="w-12" />
        </div>
        <p className="text-center text-[11px] text-white/50">L’image est analysée par une IA open source puis oubliée : rien n’est enregistré.</p>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => fromFile(e.target.files?.[0])} />
      </div>
    </div>,
    document.body,
  );
}
