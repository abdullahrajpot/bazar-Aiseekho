import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';
import { ITEM_NAMES, BASELINE_PRICES } from '../lib/constants';
import { normalizeAreaKey } from '../lib/area';

export interface PriceReport {
  id: string;
  itemId: string;
  itemName: string;
  itemNameUrdu: string;
  price: number;
  fairPrice: number;
  shopId: string;
  shopName: string;
  verdict: 'fair' | 'high' | 'gouging' | null;
  percentOver: number;
  timestamp: number;
}

export const useMarketPrices = (area: string | null) => {
  const [prices, setPrices] = useState<PriceReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!area) {
      setPrices([]);
      setLoading(false);
      return;
    }

    const areaKey = normalizeAreaKey(area);
    const pricesRef = ref(db, `prices/${areaKey}`);

    const unsubscribe = onValue(pricesRef, (snapshot) => {
      const data = snapshot.val();
      const flattened: PriceReport[] = [];

      if (data) {
        Object.entries(data).forEach(([itemId, itemData]: [string, any]) => {
          if (!itemData?.reports) return;
          const fairPrice =
            itemData.fairPrice ?? itemData.fair_price ?? BASELINE_PRICES[itemId]?.normal ?? 0;
          Object.entries(itemData.reports).forEach(([reportId, report]: [string, any]) => {
            flattened.push({
              id: reportId,
              itemId,
              itemName: ITEM_NAMES[itemId]?.english || itemId,
              itemNameUrdu: ITEM_NAMES[itemId]?.urdu || itemId,
              price: report.price,
              fairPrice: report.fairPrice ?? report.fair_price ?? fairPrice,
              shopId: report.shopId ?? report.shop_id ?? '',
              shopName: report.shopName ?? report.shop_name ?? 'Unknown shop',
              verdict: report.verdict || null,
              percentOver: report.percentOver ?? report.percent_over ?? 0,
              timestamp: report.timestamp || 0,
            });
          });
        });
      }

      const order = { gouging: 0, high: 1, fair: 2 };
      flattened.sort((a, b) => {
        const ao = order[a.verdict as keyof typeof order] ?? 3;
        const bo = order[b.verdict as keyof typeof order] ?? 3;
        if (ao !== bo) return ao - bo;
        return b.timestamp - a.timestamp;
      });

      setPrices(flattened);
      setLoading(false);
    });

    return () => off(pricesRef);
  }, [area]);

  return { prices, loading };
};
