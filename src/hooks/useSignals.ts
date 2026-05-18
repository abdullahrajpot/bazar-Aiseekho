import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';

export interface TelemetrySignal {
  source: 'twitter' | 'whatsapp' | 'weather' | 'ndma' | 'route_maps' | 'free_feeds';
  text: string;
  timestamp: number;
  area?: string;
  score?: number;
}

export const useSignals = () => {
  const [signals, setSignals] = useState<TelemetrySignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const signalsRef = ref(db, 'signals/latest/signals');
    const unsubscribe = onValue(signalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data)) {
        setSignals(data);
      } else if (data && typeof data === 'object') {
        setSignals(Object.values(data));
      } else {
        setSignals([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { signals, loading };
};
