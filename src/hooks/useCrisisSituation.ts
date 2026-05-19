import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';
import { normalizeAreaKey } from '../lib/area';

export interface CrisisSituation {
  situationType: string;
  situationLabel?: string;
  situationLabelUrdu?: string;
  confidence: number;
  severity: string;
  impacts?: string[];
  evidence?: Array<{ source: string; text: string; score: number }>;
  explanationEnglish?: string;
  explanationUrdu?: string;
  active?: boolean;
  plan?: unknown[];
  simulationSummary?: string;
  ticketId?: string;
  updatedAt?: number;
}

export interface CrisisSimulation {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  outcome?: string;
  executionLog?: Array<{ step: string; status: string; detail?: string }>;
  simulatedAt?: number;
}

export interface MapRouteEntry {
  id: string;
  name: string;
  road: string;
  status: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  isAlternate?: boolean;
  isRecommended?: boolean;
  extraMinutes?: number;
  reasoning?: string;
}

export const useCrisisSituation = (area?: string | null) => {
  const [situation, setSituation] = useState<CrisisSituation | null>(null);
  const [actions, setActions] = useState<unknown>(null);
  const [simulation, setSimulation] = useState<CrisisSimulation | null>(null);
  const [mapRoutes, setMapRoutes] = useState<MapRouteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!area) {
      setLoading(false);
      return;
    }
    const areaKey = normalizeAreaKey(area);

    const refs = [
      ref(db, `crisis_situations/${areaKey}`),
      ref(db, `crisis_actions/${areaKey}`),
      ref(db, `crisis_simulation/${areaKey}`),
      ref(db, `map_routes/${areaKey}`),
    ];

    const unsubs = refs.map((r, i) =>
      onValue(r, (snap) => {
        const val = snap.val();
        if (i === 0) setSituation(val);
        else if (i === 1) setActions(val);
        else if (i === 2) setSimulation(val);
        else if (i === 3) setMapRoutes(val?.routes || []);
        setLoading(false);
      })
    );

    return () => refs.forEach((r) => off(r));
  }, [area]);

  return { situation, actions, simulation, mapRoutes, loading };
};
