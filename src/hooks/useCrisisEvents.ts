import { useState, useEffect } from 'react';
import { ref, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizeAreaKey } from '../lib/area';
import { TimeRange, timeRangeMs } from '../lib/crisisSeverity';

export interface CrisisEvent {
  id: string;
  type: string;
  location: string;
  locationCoords?: { lat: number; lng: number };
  severity: string;
  confidence: number;
  status: string;
  detectedAt: number;
  inputText?: string;
  imageUrl?: string;
  areaKey?: string;
}

export const useCrisisEvents = (area?: string | null, timeRange: TimeRange = '7d') => {
  const [crises, setCrises] = useState<CrisisEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const crisisRef = query(ref(db, 'crisis_events'), orderByChild('detectedAt'), limitToLast(30));

    const unsub = onValue(crisisRef, (snapshot) => {
      const data = snapshot.val() || {};
      const areaKey = area ? normalizeAreaKey(area) : null;
      let list: CrisisEvent[] = Object.entries(data).map(([id, c]: [string, any]) => ({
        id,
        ...c,
      }));

      if (areaKey) {
        list = list.filter(
          (c) =>
            c.areaKey === areaKey ||
            (c.location || '').toLowerCase().includes(areaKey.replace(/_/g, ' ')) ||
            (area || '').toLowerCase().includes((c.location || '').toLowerCase().split(' ')[0])
        );
      }

      const cutoff = Date.now() - timeRangeMs(timeRange);
      list = list.filter((c) => (c.detectedAt || 0) >= cutoff && c.status !== 'resolved');
      list.sort((a, b) => (b.detectedAt || 0) - (a.detectedAt || 0));
      setCrises(list);
      setLoading(false);
    });

    return () => off(crisisRef);
  }, [area, timeRange]);

  return { crises, loading };
};
