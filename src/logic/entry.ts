import { meatRule, type CountMethod, type Food } from '@/data/foods-tr';
import type { CartItem } from '@/store/foods';
import { mealBefore } from './postmeal';
import type { LogEntry, LogItem, Settings } from './types';

export function entryBgStatus(bg: number, post: boolean, settings: Pick<Settings, 'hypoThreshold' | 'fastingRange' | 'postRange'>): 'hypo' | 'below' | 'target' | 'above' {
  if (bg < settings.hypoThreshold) return 'hypo';
  const range = post ? settings.postRange : settings.fastingRange;
  return bg < range.low ? 'below' : bg > range.high ? 'above' : 'target';
}

export const entryCartSignature = (cart: CartItem[]) => JSON.stringify(cart);

export function entryItemsToCart(items: LogItem[], foods: Food[], makeId: () => string): CartItem[] {
  return items.filter((item) => item.foodId !== 'rule-meat').map((item) => ({
    id: makeId(),
    foodId: item.foodId,
    name: item.name,
    grams: item.grams,
    carbs: item.carbs,
    fatty: item.fatty,
    meat: foods.find((food) => food.id === item.foodId)?.meat,
  }));
}

export function withEntryMeatRule(items: LogItem[], foods: Food[], method: CountMethod): LogItem[] {
  const actual = items.filter((item) => item.foodId !== 'rule-meat');
  const carbs = meatRule(actual.map((item) => ({ grams: item.grams, meat: foods.find((food) => food.id === item.foodId)?.meat })), method);
  if (!carbs) return actual;
  const previous = items.find((item) => item.foodId === 'rule-meat');
  return [...actual, { ...previous, foodId: 'rule-meat', name: 'Et kuralı (100 g üzeri et)', grams: 0, carbs }];
}

export function entryPostOwnerId(entries: LogEntry[], at: number, existing?: LogEntry, afterSource?: LogEntry): string | undefined {
  return afterSource?.id ?? (existing?.post ? existing.afterId : undefined) ?? mealBefore(entries, at, existing?.id)?.id;
}
