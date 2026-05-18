import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizeAreaKey } from '../lib/area';

export interface TruthClaim {
  id: string;
  text: string;
  verdict: 'verified' | 'unverified' | 'false';
  confidence?: number;
  reasonUrdu?: string;
  reason_urdu?: string;
  counterMessageUrdu?: string;
  counter_message?: string;
  area?: string;
  source?: string;
  timestamp: number;
}

export const useTruthFeed = (area?: string | null) => {
  const [claims, setClaims] = useState<TruthClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const areaKey = area ? normalizeAreaKey(area) : null;
    const feedRef = ref(db, 'truth_feed');

    const unsubscribe = onValue(feedRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setClaims([]);
        setLoading(false);
        return;
      }

      const list: TruthClaim[] = Object.entries(data)
        .map(([id, claim]: [string, any]) => ({ id, ...claim }))
        .filter((c) => !areaKey || !c.area || c.area === areaKey)
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 20);

      setClaims(list);
      setLoading(false);
    });

    return () => off(feedRef);
  }, [area]);

  return { claims, loading };
};
