import { carbsFor, FOODS } from '@/data/foods-tr';
import { useFoods, cartTotal, currentMealItems } from '../foods';
import { DEFAULT_SETTINGS, useSettings } from '../settings';

jest.mock('../storage', () => ({ storage: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined }, uid: () => Math.random().toString(36) }));

describe('saved meal and restore consistency', () => {
  beforeEach(() => {
    useFoods.setState({ cart: [], customFoods: [], favorites: [], meals: [] });
    useSettings.setState({ settings: { ...DEFAULT_SETTINGS, countMethod: 'exchange' } });
  });
  it('recomputes a saved template with the current carbohydrate counting method', () => {
    const food = FOODS.find((f) => f.name === 'Muz');
    if (!food) throw new Error('Missing synthetic food fixture');
    useFoods.getState().addToCart({ foodId: food.id, name: food.name, grams: 120, carbs: carbsFor(food, 120, 'exchange') });
    useFoods.getState().saveMeal('Synthetic meal');
    useSettings.getState().update({ countMethod: 'composition' });
    useFoods.getState().clearCart();
    expect(cartTotal(currentMealItems(useFoods.getState().meals[0].items))).toBe(24);
    useFoods.getState().loadMeal(useFoods.getState().meals[0].id);
    expect(useFoods.getState().cart[0].carbs).toBe(24);
    expect(cartTotal(useFoods.getState().cart)).toBe(24);
  });
  it('clears the previous cart when replacing restored food data', () => {
    useFoods.getState().addToCart({ foodId: 'synthetic', name: 'Synthetic food', grams: 100, carbs: 50 });
    useFoods.getState().replaceAll({ customFoods: [], favorites: [], meals: [] });
    expect(useFoods.getState().cart).toEqual([]);
  });
});
