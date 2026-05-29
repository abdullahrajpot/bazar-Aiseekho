import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizeAreaKey } from '../lib/area';

export interface AffectedZone {
  id: string;
  center: { lat: number; lng: number };
  radiusMeters: number;
  severity: string;
  type: string;
  label: string;
}

export const useAffectedZones = (area?: string | null) => {
  const [zones, setZones] = useState<AffectedZone[]>([]);
  const [activeCrisisId, setActiveCrisisId] = useState<string | null>(null);

  useEffect(() => {
    if (!area) {
      setZones([]);
      return;
    }
    const areaKey = normalizeAreaKey(area);
    const zRef = ref(db, `crisis_affected_zones/${areaKey}`);

    const unsub = onValue(zRef, (snap) => {
      const val = snap.val();
      setZones(val?.zones || []);
      setActiveCrisisId(val?.activeCrisisId || null);
    });

    return () => off(zRef);
  }, [area]);

  return { zones, activeCrisisId };
};
