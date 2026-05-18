const MONITORED_ROUTES = [
  { id: 'M9_surjani', name: 'M9 — Surjani route', origin: '24.8607,67.0011', destination: '24.9214,67.0686', road: 'M9' },
  { id: 'N55_alt', name: 'N55 — Alternate', origin: '24.8607,67.0011', destination: '24.9214,67.0686', road: 'N55' },
  { id: 'SHP_mandi', name: 'Super Highway — Mandi', origin: '24.8588,67.0104', destination: '24.8632,67.0578', road: 'SHP' },
  { id: 'local_orangi', name: 'Orangi local routes', origin: '24.9101,67.0219', destination: '24.9286,67.0401', road: 'local' },
];

const KARACHI_CENTER = { lat: 24.8607, lon: 67.0011 };

function normalizeAreaKey(area) {
  if (!area) return 'surjani';
  const key = area
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u2013\u2014\u2212\-–—]/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/_town$/, '')
    .replace(/^surjani_town$/, 'surjani');
  return key || 'surjani';
}

module.exports = { MONITORED_ROUTES, KARACHI_CENTER, normalizeAreaKey };
