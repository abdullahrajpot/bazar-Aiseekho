import { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizeAreaKey } from '../lib/area';

export interface TelemetrySignal {
  source: string;
  text: string;
  timestamp: number;
  area?: string;
  score?: number;
}

function signalMatchesArea(sig: TelemetrySignal, areaKey: string, displayArea: string) {
  if (sig.area === areaKey) return true;
  const t = (sig.text || '').toLowerCase();
  const keySpaced = areaKey.replace(/_/g, ' ');
  const city = displayArea.toLowerCase().split(' — ')[0].trim();
  return (
    t.includes(keySpaced) ||
    t.includes(displayArea.toLowerCase()) ||
    (city.length > 3 && t.includes(city))
  );
}

export const useSignals = (area?: string | null) => {
  const [allSignals, setAllSignals] = useState<TelemetrySignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const signalsRef = ref(db, 'signals/latest/signals');
    const unsubscribe = onValue(signalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data)) {
        setAllSignals(data);
      } else if (data && typeof data === 'object') {
        setAllSignals(Object.values(data));
      } else {
        setAllSignals([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signals = useMemo(() => {
    if (!area) return allSignals;
    const areaKey = normalizeAreaKey(area);
    return allSignals.filter((s) => signalMatchesArea(s, areaKey, area));
  }, [allSignals, area]);

  return { signals, allSignals, loading };
};
