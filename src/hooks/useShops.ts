import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';

export interface ShopRecord {
  id: string;
  name?: string;
  reputation?: 'fair' | 'at_risk' | 'flagged';
  warningCount?: number;
  warning_count?: number;
  location?: { lat: number; lng: number };
  [key: string]: unknown;
}

export const useShops = (filter?: 'fair' | 'at_risk' | 'flagged') => {
  const [shops, setShops] = useState<ShopRecord[]>([]);
  const [shopsRecord, setShopsRecord] = useState<Record<string, ShopRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const shopsRef = ref(db, 'shops');

    const unsubscribe = onValue(shopsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let shopList = Object.keys(data).map((key) => ({
          id: key,
          ...data[key],
        }));

        if (filter) {
          shopList = shopList.filter((shop) => shop.reputation === filter);
        }

        setShops(shopList);
        setShopsRecord(data);
      } else {
        setShops([]);
        setShopsRecord({});
      }
      setLoading(false);
    });

    return () => off(shopsRef);
  }, [filter]);

  return { shops, shopsRecord, loading };
};
