import { create } from "zustand";
import type { CartItem, Product, SessionData } from "../types";

interface SessionStore extends SessionData {
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  resetSession: () => void;
  setAddress: (address: string) => void;
  setRecipientName: (name: string) => void;
  setRecipientPhone: (phone: string) => void;
  setDeliveryDate: (date: string) => void;
  setDeliveryTime: (time: string) => void;
  setGiftNote: (note: string) => void;
  getTotal: () => number;
  getCartItems: () => CartItem[];
  toSessionData: () => SessionData;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  cart: [],
  address: undefined,
  recipientName: undefined,
  recipientPhone: undefined,
  deliveryDate: undefined,
  deliveryTime: undefined,
  giftNote: undefined,

  addToCart: (product) => {
    set((state) => {
      const existing = state.cart.find((i) => i.id === product.id);
      if (existing) {
        return {
          cart: state.cart.map((i) =>
            i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          ),
        };
      }
      return { cart: [...state.cart, { ...product, quantity: 1 }] };
    });
  },

  removeFromCart: (productId) => {
    set((state) => ({
      cart: state.cart.filter((i) => i.id !== productId),
    }));
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeFromCart(productId);
      return;
    }
    set((state) => ({
      cart: state.cart.map((i) =>
        i.id === productId ? { ...i, quantity } : i
      ),
    }));
  },

  clearCart: () => set({ cart: [] }),
  resetSession: () =>
    set({
      cart: [],
      address: undefined,
      recipientName: undefined,
      recipientPhone: undefined,
      deliveryDate: undefined,
      deliveryTime: undefined,
      giftNote: undefined,
    }),

  setAddress: (address) => set({ address }),
  setRecipientName: (recipientName) => set({ recipientName }),
  setRecipientPhone: (recipientPhone) => set({ recipientPhone }),
  setDeliveryDate: (deliveryDate) => set({ deliveryDate }),
  setDeliveryTime: (deliveryTime) => set({ deliveryTime }),
  setGiftNote: (giftNote) => set({ giftNote }),

  getTotal: () => {
    const { cart } = get();
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  },

  getCartItems: () => get().cart,

  toSessionData: (): SessionData => {
    const s = get();
    return {
      cart: s.cart,
      address: s.address,
      recipientName: s.recipientName,
      recipientPhone: s.recipientPhone,
      deliveryDate: s.deliveryDate,
      deliveryTime: s.deliveryTime,
      giftNote: s.giftNote,
    };
  },
}));
