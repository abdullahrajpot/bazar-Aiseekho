import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizeAreaKey } from '../lib/area';

export interface RouteRecommendation {
  blocked_road: string;
  alternate_route: string;
  recommended_route: string;
  eta_extra_minutes: number;
  safety_score: number;
  route_status: string;
  public_alert_urdu?: string;
  public_alert_english?: string;
  goods?: string[];
  updated?: number;
}

export function useRouteRecommendations(area: string | null) {
  const [recommendation, setRecommendation] = useState<RouteRecommendation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!area) {
      setLoading(false);
      return;
    }
    const key = normalizeAreaKey(area);
    const recRef = ref(db, `route_recommendations/${key}`);
    const unsub = onValue(recRef, (snapshot) => {
      setRecommendation(snapshot.val());
      setLoading(false);
    });
    return () => unsub();
  }, [area]);

  return { recommendation, loading };
}
