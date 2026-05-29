import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizeAreaKey } from '../lib/area';

export interface SupplyChip {
  itemId: string;
  status: 'ok' | 'warning' | 'critical';
  label: string;
}

export const useRegionalMarket = (area?: string | null) => {
  const [supply, setSupply] = useState<SupplyChip[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  useEffect(() => {
    if (!area) return;
    const areaKey = normalizeAreaKey(area);
    const r = ref(db, `regional_market/${areaKey}`);

    const unsub = onValue(r, (snap) => {
      const val = snap.val();
      setSupply(val?.supply || []);
      setUpdatedAt(val?.updatedAt || null);
    });

    return () => off(r);
  }, [area]);

  return { supply, updatedAt };
};
