export default function Logo({ light = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-xl font-extrabold tracking-tight ${className}`}>
      <svg viewBox="0 0 64 64" className="h-8 w-8 shrink-0" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill={light ? '#ffffff' : '#0f1b3d'} />
        <path d="M16 44c8 0 8-12 16-12s8-12 16-12" fill="none" stroke="#1fbf7a" strokeWidth="5" strokeLinecap="round" strokeDasharray="0.1 9" />
        <circle cx="16" cy="44" r="6" fill="#1fbf7a" />
        <path d="M48 12c-4.4 0-8 3.4-8 7.7C40 25.5 48 32 48 32s8-6.5 8-12.3C56 15.4 52.4 12 48 12z" fill={light ? '#0f1b3d' : '#fff'} />
        <circle cx="48" cy="19.5" r="3" fill={light ? '#fff' : '#0f1b3d'} />
      </svg>
      <span className={light ? 'text-white' : 'text-ink'}>
        Traject<span className="text-brand-500">AI</span>
      </span>
    </span>
  );
}
