import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CATEGORIES } from '../lib/constants';

const PARIS = [48.8566, 2.3522];

function pinIcon({ color, content, active = false, done = false }) {
  const size = active ? 40 : 34;
  return L.divIcon({
    className: 'traject-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${done ? '#94a3b8' : color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;border:3px solid #fff;box-shadow:0 4px 14px rgba(15,27,61,.35);${active ? 'outline:4px solid rgba(26,168,108,.35);' : ''}">${content}</div>`,
  });
}

const homeIcon = () =>
  pinIcon({
    color: '#1aa86c',
    content:
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  });

function FitBounds({ points }) {
  const map = useMap();
  const key = points.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join('|');
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 15);
    else map.fitBounds(points, { padding: [48, 48], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

export default function TripMap({ start, stops = [], geometry, activeIndex = -1, doneUntil = -1, livePosition, className = '' }) {
  const all = useMemo(() => [...(start ? [[start.lat, start.lon]] : []), ...stops.map((s) => [s.lat, s.lon])], [start, stops]);

  return (
    <MapContainer center={PARIS} zoom={13} scrollWheelZoom className={`h-full w-full ${className}`} zoomControl={false} attributionControl>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        className="traject-tiles"
        maxZoom={19}
      />
      <FitBounds points={all} />
      {geometry?.length > 1 && (
        <>
          <Polyline positions={geometry} pathOptions={{ color: '#0f1b3d', weight: 10, opacity: 0.12 }} />
          <Polyline positions={geometry} pathOptions={{ color: '#1aa86c', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }} />
        </>
      )}
      {start && (
        <Marker position={[start.lat, start.lon]} icon={homeIcon()}>
          <Tooltip direction="top" offset={[0, -18]}>
            Départ : {start.label}
          </Tooltip>
        </Marker>
      )}
      {stops.map((s, i) => {
        const cat = CATEGORIES[s.category] || CATEGORIES.autre;
        return (
          <Marker
            key={s.id || i}
            position={[s.lat, s.lon]}
            icon={pinIcon({ color: cat.color, content: i + 1, active: i === activeIndex, done: i < doneUntil })}
            zIndexOffset={i === activeIndex ? 1000 : 0}
          >
            <Tooltip direction="top" offset={[0, -18]}>
              <strong>{i + 1}. {s.label}</strong>
              {s.arrival ? ` — arrivée ${s.arrival}` : ''}
            </Tooltip>
          </Marker>
        );
      })}
      {livePosition && (
        <>
          <CircleMarker center={livePosition} radius={16} pathOptions={{ color: '#2a78d6', weight: 0, fillOpacity: 0.18 }} />
          <CircleMarker center={livePosition} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2a78d6', fillOpacity: 1 }} />
        </>
      )}
    </MapContainer>
  );
}
