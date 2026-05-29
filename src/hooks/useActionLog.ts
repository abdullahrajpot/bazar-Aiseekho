import { useState, useEffect } from 'react';
import { ref, onValue, off, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from '../lib/firebase';

export const useActionLog = (crisisId?: string | null) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const logRef = query(ref(db, 'action_log'), orderByChild('timestamp'), limitToLast(60));

    const unsub = onValue(logRef, (snapshot) => {
      const data = snapshot.val() || {};
      let list = Object.entries(data)
        .map(([id, e]: [string, any]) => ({ id, ...e }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      if (crisisId) list = list.filter((e) => e.crisisId === crisisId);

      setEntries(list.slice(0, 40));
      setLoading(false);
    });

    return () => off(logRef);
  }, [crisisId]);

  return { entries, loading };
};
