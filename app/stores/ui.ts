import { create } from 'zustand';

/**
 * Example global UI store (Zustand). Keep server data in TanStack Query;
 * use this for ephemeral client-only UI state.
 */
interface UiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebar: (open) => set({ sidebarOpen: open }),
}));
