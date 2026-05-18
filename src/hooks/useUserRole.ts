import { useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../lib/firebase';
import { useUserStore } from '../store/userStore';

export const useUserRole = () => {
  const { uid, setRoleInfo, role, area, shopId } = useUserStore();

  useEffect(() => {
    if (!uid) {return;}

    const userRef = ref(db, `users/${uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data && data.role) {
        setRoleInfo(data.role, data.area, data.shopId);
      }
    });

    return () => unsubscribe();
  }, [uid, setRoleInfo]);

  return { role, area, shopId };
};
