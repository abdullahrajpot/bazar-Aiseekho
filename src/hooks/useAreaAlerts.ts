import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizeAreaKey } from '../lib/area';

export interface AreaAlert {
  id: string;
  agent: string;
  action: string;
  severity: 'critical' | 'warning' | 'info' | string;
  detail: string;
  source?: string;
  area?: string;
  areaLabel?: string;
  timestamp: number;
}

export const useAreaAlerts = (area?: string | null) => {
  const [alerts, setAlerts] = useState<AreaAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!area) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const areaKey = normalizeAreaKey(area);
    const alertsRef = ref(db, `area_alerts/${areaKey}`);

    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      const list: AreaAlert[] = Object.entries(data)
        .map(([id, row]: [string, any]) => ({ id, ...row }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 30);

      setAlerts(list);
      setLoading(false);
    });

    return () => off(alertsRef);
  }, [area]);

  return { alerts, loading };
};
