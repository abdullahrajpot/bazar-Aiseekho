const { AREA_COORDINATES, normalizeAreaKey } = require('./constants');

const KARACHI_KEYS = new Set([
  'surjani',
  'orangi',
  'korangi',
  'lyari',
  'north_karachi',
  'north_nazimabad',
  'gulshan',
  'gulshan_e_iqbal',
  'saddar',
  'malir',
  'clifton',
]);

function isKarachiArea(areaKey) {
  return KARACHI_KEYS.has(areaKey);
}

/** Route definitions per user area (mirrors app src/lib/area.ts) */
function getAreaRoutes(areaLabel) {
  const key = normalizeAreaKey(areaLabel);
  const coord = AREA_COORDINATES[key] || { latitude: 24.89, longitude: 67.04 };
  const namePrefix = String(areaLabel || key)
    .split(' — ')
    .pop()
    .replace(/_/g, ' ');

  if (isKarachiArea(key)) {
    return [
      { id: 'M9_surjani', name: 'M9 — Surjani route', road: 'M9' },
      { id: 'N55_alt', name: 'N55 — Alternate bypass', road: 'N55' },
      { id: 'SHP_mandi', name: 'Super Highway — Mandi link', road: 'SHP' },
      { id: 'local_orangi', name: 'Orangi Local link', road: 'local' },
    ];
  }

  return [
    { id: `${key}_main`, name: `Main corridor — ${namePrefix}`, road: 'main' },
    { id: `${key}_alt`, name: `Alternate bypass — ${namePrefix}`, road: 'alt' },
    { id: `${key}_mandi`, name: `Mandi link — ${namePrefix}`, road: 'mandi' },
  ];
}

function signalMatchesArea(signal, areaKey, areaLabel) {
  const text = `${signal.text || ''} ${signal.area || ''}`.toLowerCase();
  const keyClean = areaKey.replace(/_/g, ' ');
  const labelClean = String(areaLabel || '').toLowerCase();
  if (signal.area === areaKey) return true;
  if (text.includes(keyClean)) return true;
  if (labelClean && text.includes(labelClean)) return true;
  const city = labelClean.split(' — ')[0].trim();
  if (city.length > 3 && text.includes(city)) return true;
  return false;
}

module.exports = { getAreaRoutes, isKarachiArea, signalMatchesArea, KARACHI_KEYS };
