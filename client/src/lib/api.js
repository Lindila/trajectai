const BASE = import.meta.env.VITE_API_URL || '';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json.details?.[0];
    throw new Error(detail ? `${json.error} : ${detail}` : json.error || `Erreur ${res.status}`);
  }
  return json;
}

export const api = {
  optimize: (body) => request('/optimize', { method: 'POST', body: JSON.stringify(body) }),
  geocode: (q, signal, near) =>
    request(`/geocode?q=${encodeURIComponent(q)}${near ? `&lat=${near.lat.toFixed(5)}&lon=${near.lon.toFixed(5)}` : ''}`, { signal }),
  visionLocate: (image, near) => request('/vision/locate', { method: 'POST', body: JSON.stringify({ image, ...(near ? { lat: near.lat, lon: near.lon } : {}) }) }),
  reverse: (lat, lon) => request(`/geocode/reverse?lat=${lat}&lon=${lon}`),
  traffic: () => request('/city/traffic'),
  velib: () => request('/city/velib'),
  co2: () => request('/city/co2'),
  assistant: (messages, context) => request('/assistant', { method: 'POST', body: JSON.stringify({ messages, context }) }),
  assistantStatus: () => request('/assistant/status'),
};
