import { View } from 'react-native';

import { Btn, T } from '@/components/ui';
import { Space, useTheme } from '@/constants/theme';
import { fmt } from '@/logic/bolus';
import { mealLabel, previousMeals } from '@/logic/meals';
import type { MealType } from '@/logic/types';
import { useFoods } from '@/store/foods';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';

const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

/** Aynı öğünde daha önce yediklerini tek dokunuşla tabağa ekler ("geçen sefer gibi"). */
export function SameAsBefore({ meal, before }: { meal: MealType; before: number }) {
  const c = useTheme();
  const entries = useLog((s) => s.entries);
  const starts = useSettings((s) => s.settings.mealStarts);
  const addToCart = useFoods((s) => s.addToCart);
  const cart = useFoods((s) => s.cart);
  const prev = previousMeals(entries, meal, starts, before, 3);
  if (prev.length === 0) return null;

  return (
    <View style={{ gap: Space.sm }}>
      <T variant="label" style={{ marginBottom: 0 }}>
        Daha önce {mealLabel(meal).toLowerCase()} öğününde yediklerin
      </T>
      {prev.map((e) => {
        const items = e.items!;
        const total = Math.round(items.reduce((s, i) => s + i.carbs, 0));
        const already = cart.length > 0 && items.every((i) => cart.some((c2) => c2.foodId === i.foodId && c2.grams === i.grams));
        return (
          <View key={e.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Space.sm, backgroundColor: c.cardAlt, borderRadius: 12, padding: Space.md }}>
            <View style={{ flex: 1 }}>
              <T variant="small" style={{ fontWeight: '600' }}>
                {DAYS[new Date(e.time).getDay()]} · {total} g karbonhidrat
              </T>
              <T variant="small" numberOfLines={2}>
                {items.map((i) => `${i.name} ${fmt(i.grams, 0)} g`).join(', ')}
              </T>
            </View>
            <Btn
              small
              variant="secondary"
              icon="add"
              title={already ? 'Eklendi' : 'Ekle'}
              disabled={already}
              onPress={() => {
                items.forEach((i) => addToCart({ foodId: i.foodId, name: i.name, grams: i.grams, carbs: i.carbs, fatty: i.fatty }));
                toast(`${items.length} yemek tabağa eklendi (${total} g)`);
              }}
            />
          </View>
        );
      })}
    </View>
  );
}
