import { create } from 'zustand';
import type { Category, MenuItem } from '@/types';

interface MenuState {
  categories: Category[];
  menuItems: MenuItem[];
  selectedCategory: string | null;
  searchQuery: string;
  isLoading: boolean;

  // Actions
  setCategories: (categories: Category[]) => void;
  setMenuItems: (items: MenuItem[]) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  updateItemAvailability: (itemId: string, isAvailable: boolean) => void;
  updateItemPrice: (itemId: string, newPrice: number) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
  categories: [],
  menuItems: [],
  selectedCategory: null,
  searchQuery: '',
  isLoading: false,

  setCategories: (categories) => set({ categories }),

  setMenuItems: (menuItems) => set({ menuItems }),

  setSelectedCategory: (categoryId) => set({ selectedCategory: categoryId }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setLoading: (loading) => set({ isLoading: loading }),

  updateItemAvailability: (itemId, isAvailable) =>
    set((state) => ({
      menuItems: state.menuItems.map((item) =>
        item.id === itemId ? { ...item, isAvailable } : item
      ),
    })),

  updateItemPrice: (itemId, newPrice) =>
    set((state) => ({
      menuItems: state.menuItems.map((item) =>
        item.id === itemId ? { ...item, basePrice: newPrice } : item
      ),
    })),
}));
