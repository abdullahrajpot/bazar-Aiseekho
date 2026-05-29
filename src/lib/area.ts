import { AREA_COORDINATES } from './constants';

/** Firebase path key for prices / truth_feed filtering — same rules as backend normalizeAreaKey */
export function normalizeAreaKey(area?: string | null): string {
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

export function formatAreaLabel(areaKey: string): string {
  if (!areaKey) return '';
  return areaKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

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

export function isKarachiArea(areaKey: string) {
  return KARACHI_KEYS.has(areaKey);
}

/** Prefer area-scoped Firebase keys — avoid applying Karachi M9 status to Faisalabad */
export function resolveRouteStatus(
  route: AreaRoute,
  routes: Record<string, any>,
  areaKey: string
): string {
  const scoped = routes[`${areaKey}_${route.id}`];
  if (scoped?.status) return scoped.status;

  if (isKarachiArea(areaKey)) {
    return routes[route.id]?.status || routes[route.road]?.status || 'clear';
  }

  return scoped?.status || 'clear';
}

export function resolveRouteMeta(
  route: AreaRoute,
  routes: Record<string, any>,
  areaKey: string
): Record<string, any> {
  const scoped = routes[`${areaKey}_${route.id}`];
  if (scoped) return scoped;
  if (isKarachiArea(areaKey)) {
    return routes[route.id] || routes[route.road] || {};
  }
  return {};
}

export interface AreaRoute {
  id: string;
  name: string;
  road: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

export function getAreaSpecificRoutes(selectedArea: string | null): AreaRoute[] {
  const displayArea = selectedArea || 'Surjani Town';
  const key = normalizeAreaKey(displayArea);
  const coord = AREA_COORDINATES[key] || { latitude: 24.89, longitude: 67.04 }; // Fallback to Karachi

  const isKarachi = [
    'surjani', 'orangi', 'korangi', 'lyari', 'north_karachi', 
    'north_nazimabad', 'gulshan', 'gulshan_e_iqbal', 'saddar', 'malir', 'clifton'
  ].includes(key);

  if (isKarachi) {
    const c = coord;
    const n = key === 'orangi' ? 0.012 : key === 'korangi' ? -0.02 : key === 'lyari' ? -0.015 : 0;
    return [
      {
        id: 'M9_surjani',
        name: `M9 — ${displayArea.split(' ')[0]} corridor`,
        road: 'M9',
        coordinates: [
          { latitude: c.latitude - 0.04 + n, longitude: c.longitude - 0.04 },
          { latitude: c.latitude - 0.02 + n, longitude: c.longitude - 0.02 },
          { latitude: c.latitude + n, longitude: c.longitude },
          { latitude: c.latitude + 0.02 + n, longitude: c.longitude + 0.02 },
          { latitude: c.latitude + 0.04 + n, longitude: c.longitude + 0.04 },
        ],
      },
      {
        id: 'N55_alt',
        name: 'N55 — Alternate bypass',
        road: 'N55',
        coordinates: [
          { latitude: c.latitude - 0.04 + n, longitude: c.longitude - 0.04 },
          { latitude: c.latitude - 0.03 + n, longitude: c.longitude - 0.06 },
          { latitude: c.latitude + n, longitude: c.longitude - 0.07 },
          { latitude: c.latitude + 0.03 + n, longitude: c.longitude - 0.05 },
          { latitude: c.latitude + 0.04 + n, longitude: c.longitude + 0.04 },
        ],
      },
      {
        id: 'SHP_mandi',
        name: 'Super Highway — Mandi link',
        road: 'SHP',
        coordinates: [
          { latitude: c.latitude - 0.02 + n, longitude: c.longitude + 0.02 },
          { latitude: c.latitude + n, longitude: c.longitude + 0.03 },
          { latitude: c.latitude + 0.02 + n, longitude: c.longitude + 0.04 },
        ],
      },
      {
        id: 'local_orangi',
        name: 'Local market link',
        road: 'local',
        coordinates: [
          { latitude: c.latitude - 0.01 + n, longitude: c.longitude - 0.01 },
          { latitude: c.latitude + n, longitude: c.longitude },
          { latitude: c.latitude + 0.01 + n, longitude: c.longitude + 0.01 },
        ],
      },
    ];
  }

  // Generate localized routes for cities/regions in Punjab, KPK, Balochistan, etc.
  // Use realistic road-like waypoints relative to the city center
  const lat = coord.latitude;
  const lng = coord.longitude;
  const namePrefix = displayArea.split(' — ').pop() || displayArea;

  // Main corridor: runs roughly east-west through city center
  const mainCoords = [
    { latitude: lat - 0.03,  longitude: lng - 0.045 },
    { latitude: lat - 0.015, longitude: lng - 0.025 },
    { latitude: lat,         longitude: lng },
    { latitude: lat + 0.01,  longitude: lng + 0.025 },
    { latitude: lat + 0.02,  longitude: lng + 0.045 },
  ];

  // Alternate bypass: loops around the south of the city
  const altCoords = [
    { latitude: lat - 0.03,  longitude: lng - 0.045 },
    { latitude: lat - 0.04,  longitude: lng - 0.02 },
    { latitude: lat - 0.038, longitude: lng + 0.01 },
    { latitude: lat - 0.025, longitude: lng + 0.035 },
    { latitude: lat + 0.02,  longitude: lng + 0.045 },
  ];

  // Mandi/grain link: short spur from city center to market area
  const mandiCoords = [
    { latitude: lat + 0.005, longitude: lng - 0.01 },
    { latitude: lat + 0.015, longitude: lng + 0.005 },
    { latitude: lat + 0.025, longitude: lng + 0.015 },
    { latitude: lat + 0.03,  longitude: lng + 0.025 },
  ];

  return [
    {
      id: `${key}_main`,
      name: `M-Highway — ${namePrefix} Main Corridor`,
      road: 'M9',
      coordinates: mainCoords,
    },
    {
      id: `${key}_alt`,
      name: `Bypass — ${namePrefix} Alternate Loop`,
      road: 'N55',
      coordinates: altCoords,
    },
    {
      id: `${key}_mandi`,
      name: `Mandi Road — ${namePrefix} Grain Link`,
      road: 'SHP',
      coordinates: mandiCoords,
    },
  ];
}

