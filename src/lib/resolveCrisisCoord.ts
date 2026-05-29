import { AREA_COORDINATES } from './constants';
import { normalizeAreaKey } from './area';
import { CrisisEvent } from '../hooks/useCrisisEvents';

export const PAKISTAN_REGION = {
  latitude: 30.3753,
  longitude: 69.3451,
  latitudeDelta: 9,
  longitudeDelta: 9,
};

export function isValidPkCoord(lat: number, lng: number): boolean {
  return lat > 23 && lat < 38 && lng > 60 && lng < 78 && !Number.isNaN(lat) && !Number.isNaN(lng);
}

/** Firebase may store lat/lng OR latitude/longitude — normalize both */
export function normalizeCoords(raw?: {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
} | null): { lat: number; lng: number } | null {
  if (!raw) return null;
  const lat = raw.lat ?? raw.latitude;
  const lng = raw.lng ?? raw.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!isValidPkCoord(lat, lng)) return null;
  return { lat, lng };
}

export function coordsForAreaLabel(area?: string | null): { lat: number; lng: number } {
  const key = normalizeAreaKey(area || 'Surjani Town');
  const c = AREA_COORDINATES[key];
  if (c) return { lat: c.latitude, lng: c.longitude };
  return { lat: PAKISTAN_REGION.latitude, lng: PAKISTAN_REGION.longitude };
}

/** Spread overlapping pins in a small circle */
export function spreadCoord(base: { lat: number; lng: number }, index: number): { lat: number; lng: number } {
  if (index === 0) return base;
  const angle = (index * 137.508) * (Math.PI / 180);
  const r = 0.018 + (index % 5) * 0.006;
  return {
    lat: base.lat + Math.sin(angle) * r,
    lng: base.lng + Math.cos(angle) * r,
  };
}

export function resolveCrisisCoord(
  crisis: CrisisEvent,
  fallbackArea: string,
  index = 0
): { lat: number; lng: number } {
  const fromEvent = normalizeCoords(crisis.locationCoords as any);
  if (fromEvent) return spreadCoord(fromEvent, index);

  const fromArea = coordsForAreaLabel(crisis.areaKey || crisis.location || fallbackArea);
  return spreadCoord(fromArea, index);
}
