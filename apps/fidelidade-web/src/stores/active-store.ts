import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Which store (loja) the lojista is currently working in. Persisted because the
 * choice has to survive a reload at the counter, and because a Pro plan lojista
 * may own more than one store.
 */
type ActiveStoreState = {
  storeId: string | null;
  setStoreId: (storeId: string | null) => void;
  clearStoreId: () => void;
};

export const useActiveStore = create<ActiveStoreState>()(
  persist(
    (set) => ({
      storeId: null,
      setStoreId: (storeId) => set({ storeId }),
      clearStoreId: () => set({ storeId: null }),
    }),
    {
      name: "fidelidade-active-store",
    },
  ),
);
