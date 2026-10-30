import { FOODS, meatRule } from '@/data/foods-tr';
import type { CartItem } from '@/store/foods';
import { entryBgStatus, entryCartSignature, entryItemsToCart, entryPostOwnerId, withEntryMeatRule } from '../entry';
import type { LogEntry, LogItem } from '../types';

describe('entry food edits', () => {
  it('classifies glucose using configured fasting, post-meal and hypo boundaries', () => {
    const settings = { hypoThreshold: 65, fastingRange: { low: 85, high: 130 }, postRange: { low: 90, high: 200 } };
    expect(entryBgStatus(125, false, settings)).toBe('target');
    expect(entryBgStatus(190, true, settings)).toBe('target');
    expect(entryBgStatus(85, true, settings)).toBe('below');
    expect(entryBgStatus(64, false, settings)).toBe('hypo');
    expect(entryBgStatus(201, true, settings)).toBe('above');
  });
  const cart: CartItem[] = [{ id: 'bread-row', foodId: 'bread', name: 'Ekmek', grams: 50, carbs: 25 }];

  it('detects a quantity and carbohydrate change on an existing picker row', () => {
    const edited = [{ ...cart[0], grams: 100, carbs: 50 }];
    expect(entryCartSignature(edited)).not.toBe(entryCartSignature(cart));
  });

  it('detects clearing the picker', () => {
    expect(entryCartSignature([])).not.toBe(entryCartSignature(cart));
  });

  it('restores meat classification when opening a saved exchange-method meal', () => {
    const meat = FOODS.find((food) => food.meat);
    if (!meat) throw new Error('Food catalog has no meat fixture');
    const restored = entryItemsToCart([
      { foodId: meat.id, name: meat.name, grams: 150, carbs: 0 },
      { foodId: 'rule-meat', name: 'Et kuralı', grams: 0, carbs: 10 },
    ], FOODS, () => 'restored-row');
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ id: 'restored-row', grams: 150, meat: true });
    expect(meatRule(restored, 'exchange')).toBe(10);
  });

  it('recalculates the synthetic rule when meat crosses the threshold or is removed', () => {
    const meat = FOODS.find((food) => food.meat);
    if (!meat) throw new Error('Food catalog has no meat fixture');
    const row: LogItem = { foodId: meat.id, name: meat.name, grams: 100, carbs: 0 };
    const oldRule: LogItem = { foodId: 'rule-meat', name: 'Et kuralı', grams: 0, carbs: 10 };
    expect(withEntryMeatRule([row, oldRule], FOODS, 'exchange')).toEqual([row]);
    expect(withEntryMeatRule([oldRule], FOODS, 'exchange')).toEqual([]);
    expect(withEntryMeatRule([{ ...row, grams: 101 }], FOODS, 'exchange')).toEqual([
      { ...row, grams: 101 },
      { foodId: 'rule-meat', name: 'Et kuralı (100 g üzeri et)', grams: 0, carbs: 10 },
    ]);
    expect(withEntryMeatRule([{ ...row, grams: 150 }, oldRule], FOODS, 'composition')).toEqual([{ ...row, grams: 150 }]);
  });

  it('preserves an explicit post-meal owner when a newer meal exists', () => {
    const first: LogEntry = { id: 'first', time: 1000, carbs: 50 };
    const snack: LogEntry = { id: 'snack', time: 2000, carbs: 10 };
    const reading: LogEntry = { id: 'post', time: 3000, bg: 140, post: true, afterId: first.id };
    expect(entryPostOwnerId([first, snack, reading], reading.time, reading)).toBe('first');
    expect(entryPostOwnerId([first, snack], 3000)).toBe('snack');
    expect(entryPostOwnerId([first, snack, reading], reading.time, reading, snack)).toBe('snack');
  });
});
