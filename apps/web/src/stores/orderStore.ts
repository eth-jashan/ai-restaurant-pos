import { create } from 'zustand';
import type { Order, CartItem, MenuItem, RestaurantTable } from '@/types';

interface OrderState {
  // Active orders
  activeOrders: Order[];
  selectedOrder: Order | null;

  // Current order being created
  cart: CartItem[];
  selectedTable: RestaurantTable | null;
  orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
  covers: number;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  orderNotes: string;

  // Actions
  setActiveOrders: (orders: Order[]) => void;
  setSelectedOrder: (order: Order | null) => void;
  updateOrderInList: (order: Order) => void;
  removeOrderFromList: (orderId: string) => void;

  // Cart actions
  addToCart: (item: MenuItem, quantity: number, modifiers?: { name: string; price: number; groupName?: string }[], notes?: string) => void;
  updateCartItem: (index: number, quantity: number) => void;
  removeFromCart: (index: number) => void;
  clearCart: () => void;

  // Order setup
  setSelectedTable: (table: RestaurantTable | null) => void;
  setOrderType: (type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY') => void;
  setCovers: (covers: number) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setCustomerAddress: (address: string) => void;
  setOrderNotes: (notes: string) => void;
  resetOrderForm: () => void;

  // Computed
  getCartTotal: () => number;
  getCartItemCount: () => number;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  activeOrders: [],
  selectedOrder: null,

  cart: [],
  selectedTable: null,
  orderType: 'DINE_IN',
  covers: 1,
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  orderNotes: '',

  setActiveOrders: (orders) => set({ activeOrders: orders }),

  setSelectedOrder: (order) => set({ selectedOrder: order }),

  updateOrderInList: (order) =>
    set((state) => ({
      activeOrders: state.activeOrders.map((o) => (o.id === order.id ? order : o)),
      selectedOrder: state.selectedOrder?.id === order.id ? order : state.selectedOrder,
    })),

  removeOrderFromList: (orderId) =>
    set((state) => ({
      activeOrders: state.activeOrders.filter((o) => o.id !== orderId),
      selectedOrder: state.selectedOrder?.id === orderId ? null : state.selectedOrder,
    })),

  addToCart: (item, quantity, modifiers = [], notes) => {
    const modifiersPrice = modifiers.reduce((sum, m) => sum + m.price, 0);
    const totalPrice = (item.basePrice + modifiersPrice) * quantity;

    const cartItem: CartItem = {
      menuItem: item,
      quantity,
      notes,
      modifiers,
      totalPrice,
    };

    set((state) => {
      // Check if same item with same modifiers exists
      const existingIndex = state.cart.findIndex(
        (ci) =>
          ci.menuItem.id === item.id &&
          JSON.stringify(ci.modifiers) === JSON.stringify(modifiers)
      );

      if (existingIndex > -1) {
        // Update existing item
        const updatedCart = [...state.cart];
        updatedCart[existingIndex] = {
          ...updatedCart[existingIndex],
          quantity: updatedCart[existingIndex].quantity + quantity,
          totalPrice: updatedCart[existingIndex].totalPrice + totalPrice,
        };
        return { cart: updatedCart };
      }

      return { cart: [...state.cart, cartItem] };
    });
  },

  updateCartItem: (index, quantity) =>
    set((state) => {
      if (quantity <= 0) {
        return { cart: state.cart.filter((_, i) => i !== index) };
      }

      const updatedCart = [...state.cart];
      const item = updatedCart[index];
      const unitPrice = item.menuItem.basePrice + item.modifiers.reduce((s, m) => s + m.price, 0);

      updatedCart[index] = {
        ...item,
        quantity,
        totalPrice: unitPrice * quantity,
      };

      return { cart: updatedCart };
    }),

  removeFromCart: (index) =>
    set((state) => ({
      cart: state.cart.filter((_, i) => i !== index),
    })),

  clearCart: () => set({ cart: [] }),

  setSelectedTable: (table) => set({ selectedTable: table }),
  setOrderType: (type) => set({ orderType: type }),
  setCovers: (covers) => set({ covers }),
  setCustomerName: (name) => set({ customerName: name }),
  setCustomerPhone: (phone) => set({ customerPhone: phone }),
  setCustomerAddress: (address) => set({ customerAddress: address }),
  setOrderNotes: (notes) => set({ orderNotes: notes }),

  resetOrderForm: () =>
    set({
      cart: [],
      selectedTable: null,
      orderType: 'DINE_IN',
      covers: 1,
      customerName: '',
      customerPhone: '',
      customerAddress: '',
      orderNotes: '',
    }),

  getCartTotal: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => sum + item.totalPrice, 0);
  },

  getCartItemCount: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
