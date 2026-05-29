import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizeAreaKey } from '../lib/area';

export interface MapIncident {
  crisisId: string;
  type: string;
  location: string;
  locationCoords?: { lat: number; lng: number };
  severity: string;
  status: string;
  hasImage?: boolean;
}

export const useMapIncidents = (area?: string | null) => {
  const [incidents, setIncidents] = useState<MapIncident[]>([]);

  useEffect(() => {
    if (!area) {
      setIncidents([]);
      return;
    }
    const areaKey = normalizeAreaKey(area);
    const incRef = ref(db, `map_incidents/${areaKey}`);

    const unsub = onValue(incRef, (snapshot) => {
      const data = snapshot.val() || {};
      const list = Object.entries(data).map(([crisisId, row]: [string, any]) => {
        const lat = row.locationCoords?.lat ?? row.locationCoords?.latitude;
        const lng = row.locationCoords?.lng ?? row.locationCoords?.longitude;
        return {
          crisisId,
          ...row,
          locationCoords:
            lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : row.locationCoords,
        };
      });
      setIncidents(list.filter((i) => i.status === 'active'));
    });

    return () => off(incRef);
  }, [area]);

  return incidents;
};
