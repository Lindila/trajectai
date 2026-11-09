// Illustration vectorielle : skyline, parc et route verte qui relie les étapes.
export default function CityIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 520 360" className={className} role="img" aria-label="Illustration d'une ville verte traversée par un itinéraire">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6f6ee" />
          <stop offset="1" stopColor="#f5f8fc" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="tower" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe9d4" />
          <stop offset="1" stopColor="#8fd6b3" />
        </linearGradient>
        <linearGradient id="tower2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d7efe4" />
          <stop offset="1" stopColor="#b4e0ca" />
        </linearGradient>
      </defs>
      <rect width="520" height="360" rx="28" fill="url(#sky)" />
      <circle cx="420" cy="70" r="34" fill="#fff4d6" />

      {/* Skyline arrière */}
      <g fill="url(#tower2)">
        <rect x="40" y="120" width="42" height="160" rx="4" />
        <rect x="92" y="90" width="36" height="190" rx="4" />
        <rect x="300" y="100" width="40" height="180" rx="4" />
        <rect x="392" y="130" width="48" height="150" rx="4" />
        <path d="M200 280V70l24-22 24 22v210z" />
      </g>
      {/* Skyline avant */}
      <g fill="url(#tower)">
        <rect x="136" y="140" width="52" height="140" rx="5" />
        <rect x="256" y="120" width="36" height="160" rx="5" />
        <rect x="348" y="150" width="38" height="130" rx="5" />
        <rect x="448" y="170" width="40" height="110" rx="5" />
      </g>
      <g fill="#ffffff" opacity="0.75">
        {[0, 1, 2, 3, 4, 5].map((r) =>
          [0, 1, 2].map((c) => <rect key={`${r}-${c}`} x={144 + c * 15} y={152 + r * 20} width="8" height="10" rx="1.5" />),
        )}
        {[0, 1, 2, 3, 4, 5, 6].map((r) => [0, 1].map((c) => <rect key={`b${r}-${c}`} x={262 + c * 14} y={132 + r * 20} width="8" height="10" rx="1.5" />))}
      </g>

      {/* Sol, parc et arbres */}
      <path d="M0 272c90-18 170-10 260-4s170 10 260-6v98H0z" fill="#cfeedd" />
      <path d="M0 300c110-20 210-6 300 0s150 2 220-12v72H0z" fill="#a9e2c4" />
      {[
        [30, 262],
        [70, 270],
        [214, 258],
        [330, 262],
        [470, 258],
        [500, 268],
      ].map(([x, y]) => (
        <g key={x}>
          <rect x={x - 2} y={y} width="4" height="16" rx="2" fill="#2e7d5b" />
          <circle cx={x} cy={y - 4} r="13" fill="#43b884" />
          <circle cx={x + 6} cy={y - 10} r="8" fill="#5fcf9a" />
        </g>
      ))}

      {/* Itinéraire */}
      <path
        d="M60 330C120 330 130 292 190 296s90 34 150 20 60-58 120-50"
        fill="none"
        stroke="#0f1b3d"
        strokeOpacity="0.12"
        strokeWidth="22"
        strokeLinecap="round"
      />
      <path
        d="M60 330C120 330 130 292 190 296s90 34 150 20 60-58 120-50"
        fill="none"
        stroke="#1aa86c"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="1 14"
      />
      {[
        [60, 330, '#1aa86c'],
        [190, 296, '#7c5cf0'],
        [340, 316, '#f59e0b'],
        [460, 266, '#2a78d6'],
      ].map(([x, y, c], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="15" fill="#fff" />
          <circle cx={x} cy={y} r="10" fill={c} />
          <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff">
            {i === 0 ? '⌂' : i}
          </text>
        </g>
      ))}

      {/* Voiture */}
      <g transform="translate(250 312)">
        <rect x="-18" y="-10" width="36" height="14" rx="6" fill="#0f1b3d" />
        <rect x="-10" y="-17" width="20" height="9" rx="4" fill="#1b2a55" />
        <circle cx="-10" cy="5" r="4" fill="#0f1b3d" stroke="#fff" strokeWidth="2" />
        <circle cx="10" cy="5" r="4" fill="#0f1b3d" stroke="#fff" strokeWidth="2" />
      </g>
    </svg>
  );
}
