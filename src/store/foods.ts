import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { carbsFor, FOODS, meatRule, type Food } from '@/data/foods-tr';
import { useSettings } from './settings';

import { storage, uid } from './storage';

export type CartItem = {
  id: string;
  foodId: string;
  name: string;
  grams: number;
  carbs: number;
  fatty?: boolean;
  meat?: boolean;
  portionLabel?: string;
  portionGrams?: number;
};
export type SavedMeal = { id: string; name: string; items: CartItem[] };

type State = {
  customFoods: Food[];
  favorites: string[];
  meals: SavedMeal[];
  cart: CartItem[];
  addCustomFood: (f: Omit<Food, 'id' | 'custom'>) => void;
  removeCustomFood: (id: string) => void;
  toggleFavorite: (id: string) => void;
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateCartGrams: (id: string, grams: number) => void;
  removeFromCart: (id: string) => void;
  setCart: (cart: CartItem[]) => void;
  clearCart: () => void;
  saveMeal: (name: string) => void;
  loadMeal: (id: string) => void;
  removeMeal: (id: string) => void;
  replaceAll: (s: Pick<State, 'customFoods' | 'favorites' | 'meals'>) => void;
};

export const useFoods = create<State>()(
  persist(
    (set, get) => ({
      customFoods: [],
      favorites: [],
      meals: [],
      cart: [],
      addCustomFood: (f) => set((st) => ({ customFoods: [...st.customFoods, { ...f, id: `custom-${uid()}`, custom: true }] })),
      removeCustomFood: (id) =>
        set((st) => ({
          customFoods: st.customFoods.filter((f) => f.id !== id),
          favorites: st.favorites.filter((x) => x !== id),
        })),
      toggleFavorite: (id) =>
        set((st) => ({
          favorites: st.favorites.includes(id) ? st.favorites.filter((x) => x !== id) : [...st.favorites, id],
        })),
      addToCart: (item) => set((st) => ({ cart: [...st.cart, { ...item, id: uid() }] })),
      updateCartGrams: (id, grams) => {
        const safeGrams = Math.max(0, grams);
        const all = [...get().customFoods, ...FOODS];
        const method = useSettings.getState().settings.countMethod;
        set((st) => ({
          cart: st.cart.map((item) => {
            if (item.id !== id) return item;
            const food = all.find((f) => f.id === item.foodId);
            const carbs = food
              ? carbsFor(food, safeGrams, method)
              : Math.round((item.carbs / Math.max(item.grams, 1)) * safeGrams);
            return { ...item, grams: safeGrams, carbs };
          }),
        }));
      },
      removeFromCart: (id) => set((st) => ({ cart: st.cart.filter((c) => c.id !== id) })),
      setCart: (cart) => set({ cart }),
      clearCart: () => set({ cart: [] }),
      saveMeal: (name) => {
        const items = get().cart;
        if (items.length === 0) return;
        set((st) => ({ meals: [...st.meals, { id: uid(), name, items }] }));
      },
      loadMeal: (id) => {
        const meal = get().meals.find((m) => m.id === id);
        if (meal) set((st) => ({ cart: [...st.cart, ...meal.items.map((i) => ({ ...i, id: uid() }))] }));
      },
      removeMeal: (id) => set((st) => ({ meals: st.meals.filter((m) => m.id !== id) })),
      replaceAll: (s) => set(s),
    }),
    { name: 'foods', storage, version: 1 },
  ),
);

/** Değişim yönteminde öğünde 100 g üzeri et varsa eklenen karbonhidrat (g); yoksa 0 */
export const cartMeatRule = (cart: CartItem[]) => meatRule(cart, useSettings.getState().settings.countMethod);

/** Sepetin toplam karbonhidratı (yönteme bağlı et kuralı dahil) */
export const cartTotal = (cart: CartItem[]) => Math.round(cart.reduce((s, c) => s + c.carbs, 0) + cartMeatRule(cart));
