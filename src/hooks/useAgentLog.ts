import { useState, useEffect } from 'react';
import { ref, onValue, query, orderByChild, limitToLast } from 'firebase/database';
import { db } from '../lib/firebase';

export const useAgentLog = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const logRef = query(ref(db, 'agent_log'), orderByChild('timestamp'), limitToLast(50));
    const unsubscribe = onValue(logRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const logList = Object.keys(data).map(key => ({
          id: key,
          ...data[key],
        }));
        logList.sort((a, b) => b.timestamp - a.timestamp); // newest first
        setLogs(logList);
      } else {
        setLogs([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { logs, loading };
};
