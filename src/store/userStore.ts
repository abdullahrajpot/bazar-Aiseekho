import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserState {
  uid: string | null;
  role: 'khareedar' | 'admin' | null;
  area: string | null;
  shopId: string | null;
  expoPushToken: string | null;
  setUser: (uid: string) => void;
  setRoleInfo: (role: 'khareedar' | 'admin', area?: string, shopId?: string) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      uid: null,
      role: null,
      area: null,
      shopId: null,
      expoPushToken: null,
      setUser: (uid) => set({ uid }),
      setRoleInfo: (role, area, shopId) =>
        set((state) => ({
          role,
          area: area !== undefined ? area || null : state.area,
          shopId: shopId !== undefined ? shopId || null : state.shopId,
        })),
      logout: () => set({ uid: null, role: null, area: null, shopId: null }),
    }),
    {
      name: 'user-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
