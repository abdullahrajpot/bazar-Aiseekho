import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';

export interface RouteStatus {
  status?: string;
  goodsAffected?: string[];
  alternate?: string;
  extraMinutes?: number;
  extra_minutes?: number;
  publicAlertUrdu?: string;
  route_name?: string;
  updatedAt?: number;
  [key: string]: unknown;
}

export const useSupplyStatus = () => {
  const [routes, setRoutes] = useState<Record<string, RouteStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const statusRef = ref(db, 'supply_status');

    const unsubscribe = onValue(statusRef, (snapshot) => {
      setRoutes(snapshot.val() || {});
      setLoading(false);
    });

    return () => off(statusRef);
  }, []);

  return { routes, supplyStatus: routes, loading };
};
