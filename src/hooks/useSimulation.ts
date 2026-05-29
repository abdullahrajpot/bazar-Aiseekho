import { useState, useEffect } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../lib/firebase';

export interface SimulationStep {
  stepId: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed';
  completedAt?: number;
  ticketId?: string;
  agentResponsible?: string;
}

export const useSimulation = (crisisId?: string | null) => {
  const [simulation, setSimulation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!crisisId) {
      setSimulation(null);
      setLoading(false);
      return;
    }

    const simRef = ref(db, `simulation_state/${crisisId}`);
    const unsub = onValue(simRef, (snapshot) => {
      setSimulation(snapshot.val());
      setLoading(false);
    });

    return () => off(simRef);
  }, [crisisId]);

  return { simulation, loading, steps: (simulation?.steps || []) as SimulationStep[] };
};
