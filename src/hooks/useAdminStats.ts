import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';

export const useAdminStats = () => {
  const [stats, setStats] = useState({
    breaksDetected: 0,
    routesRerouted: 0,
    rumoursSuppressed: 0,
    gougingShopsFlagged: 0,
    familiesServedEstimate: 0,
    priceSpikeReducedPercent: 0,
  });

  useEffect(() => {
    const statsRef = ref(db, 'admin_stats');
    const unsubscribe = onValue(statsRef, (snapshot) => {
      if (snapshot.exists()) {
        const raw = snapshot.val();
        setStats({
          breaksDetected: raw.breaksDetected ?? raw.breaks_detected ?? 0,
          routesRerouted: raw.routesRerouted ?? raw.routes_rerouted ?? 0,
          rumoursSuppressed: raw.rumoursSuppressed ?? raw.rumours_suppressed ?? 0,
          gougingShopsFlagged: raw.gougingShopsFlagged ?? raw.gouging_shops_flagged ?? 0,
          familiesServedEstimate: raw.familiesServedEstimate ?? 0,
          priceSpikeReducedPercent: raw.priceSpikeReducedPercent ?? 0,
        });
      }
    });

    return () => unsubscribe();
  }, []);

  return stats;
};
