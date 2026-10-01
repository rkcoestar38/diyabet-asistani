import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Btn, Card, Field, Notice, Row, Screen, T, Toggle, confirm, parseNum } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { CATEGORIES, FOODS, MEAT_RULE_CARBS, MEAT_RULE_GRAMS, carbsFor, normalize, per100 as foodPer100, type Food } from '@/data/foods-tr';
import { fmt } from '@/logic/bolus';
import { MealChips, useWhen } from '@/components/when';
import { SameAsBefore } from '@/components/same-meal';
import { useNow } from '@/lib/hooks';
import { useDraft } from '@/store/draft';
import { cartMeatRule, cartTotal, useFoods } from '@/store/foods';
import { useSettings } from '@/store/settings';
import { toast } from '@/store/toast';

const FAV = 'Favoriler';
const MINE = 'Benim yemeklerim';

export function FoodBrowser({ picker }: { picker?: boolean }) {
  const c = useTheme();
  const { customFoods, favorites, meals, cart, toggleFavorite, addToCart, removeFromCart, clearCart, saveMeal, loadMeal, removeMeal, removeCustomFood } =
    useFoods();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>(FAV);
  const [selected, setSelected] = useState<Food | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [mealName, setMealName] = useState('');

  const all = useMemo(() => [...customFoods, ...FOODS], [customFoods]);
  const list = useMemo(() => {
    if (query.trim()) {
      const q = normalize(query);
      return all.filter((f) => normalize(f.name).includes(q)).slice(0, 60);
    }
    if (category === FAV) return all.filter((f) => favorites.includes(f.id));
    if (category === MINE) return customFoods;
    return all.filter((f) => f.category === category);
  }, [all, query, category, favorites, customFoods]);

  const total = cartTotal(cart);
  const method = useSettings((s) => s.settings.countMethod);
  const meatExtra = cartMeatRule(cart);
  const now = useNow(60000);
  const when = useWhen(now);
  const setDraft = useDraft((s) => s.set);

  return (
    <Screen>
      {/* Tabak */}
      <Card
        title={`Tabağım: ${total} g karbonhidrat`}
        icon="restaurant"
        right={cart.length ? <Btn small variant="ghost" title="Temizle" onPress={clearCart} /> : null}>
        <MealChips value={when.meal} auto={when.isAuto} onChange={(m) => setDraft({ meal: m })} />
        <SameAsBefore meal={when.meal} before={when.doseTime} />
        {cart.length === 0 ? (
          <T variant="muted">Aşağıdan yemek seç; porsiyon veya gram gir. Toplam, Hesapla ekranına aktarılır.</T>
        ) : (
          <>
            {cart.map((i) => (
              <View key={i.id} style={[styles.cartRow, { borderColor: c.border }]}>
                <T style={{ flex: 1 }}>
                  {i.name} <T variant="muted">· {fmt(i.grams, 0)} g</T>
                </T>
                <T style={{ fontWeight: '700' }}>{fmt(i.carbs)} g</T>
                <Pressable onPress={() => removeFromCart(i.id)} hitSlop={10} accessibilityLabel={`${i.name} çıkar`}>
                  <Ionicons name="close-circle" size={22} color={c.muted} />
                </Pressable>
              </View>
            ))}
            {meatExtra > 0 ? (
              <View style={[styles.cartRow, { borderColor: c.border }]}>
                <T style={{ flex: 1 }}>
                  Et kuralı <T variant="muted">· {MEAT_RULE_GRAMS} g üzeri et</T>
                </T>
                <T style={{ fontWeight: '700' }}>+{fmt(meatExtra)} g</T>
              </View>
            ) : null}
            {cart.some((i) => i.fatty) ? (
              <Notice level="info" text="Yağlı/proteinli yiyecekler şekeri geç yükseltebilir; 2–3 saat sonra tekrar ölç." />
            ) : null}
            <Row>
              <Field label="Öğün olarak kaydet" keyboard="text" placeholder="ör. Kahvaltım" value={mealName} onChangeText={setMealName} />
              <Btn
                small
                variant="secondary"
                icon="bookmark-outline"
                title="Kaydet"
                disabled={!mealName.trim()}
                onPress={() => {
                  saveMeal(mealName.trim());
                  setMealName('');
                }}
              />
            </Row>
            <Btn
              title={picker ? `Hesaplamaya dön (${total} g)` : `Doz hesapla (${total} g)`}
              icon={picker ? 'checkmark' : 'calculator'}
              onPress={() => (picker ? router.back() : router.navigate('/calc'))}
            />
          </>
        )}
      </Card>

      {meals.length > 0 ? (
        <Card title="Kayıtlı öğünler" icon="bookmark">
          {meals.map((m) => (
            <View key={m.id} style={[styles.cartRow, { borderColor: c.border }]}>
              <Pressable style={{ flex: 1 }} onPress={() => loadMeal(m.id)}>
                <T>{m.name}</T>
                <T variant="small">
                  {cartTotal(m.items)} g · {m.items.map((i) => i.name).join(', ')}
                </T>
              </Pressable>
              <Btn small variant="secondary" title="Ekle" onPress={() => loadMeal(m.id)} />
              <Pressable onPress={() => confirm('Öğünü sil', `"${m.name}" silinsin mi?`, () => removeMeal(m.id), 'Sil')} hitSlop={10}>
                <Ionicons name="trash-outline" size={20} color={c.muted} />
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Seçili yemek */}
      {selected ? (
        <AddFood
          key={selected.id}
          food={selected}
          onClose={() => setSelected(null)}
          onAdd={(grams) => {
            const item = { foodId: selected.id, name: selected.name, grams, carbs: carbsFor(selected, grams, method), fatty: selected.fatty, meat: selected.meat };
            addToCart(item);
            toast(`${selected.name} eklendi · tabakta ${cartTotal([...cart, { ...item, id: 'tmp' }])} g`);
            setSelected(null);
          }}
          favorite={favorites.includes(selected.id)}
          onToggleFavorite={() => toggleFavorite(selected.id)}
          onDelete={
            selected.custom
              ? () => confirm('Yemeği sil', `"${selected.name}" silinsin mi?`, () => { removeCustomFood(selected.id); setSelected(null); }, 'Sil')
              : undefined
          }
        />
      ) : null}

      {/* Arama */}
      <View style={[styles.search, { backgroundColor: c.card, borderColor: c.border }]}>
        <Ionicons name="search" size={20} color={c.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Yemek ara (ör. simit, pilav)"
          placeholderTextColor={c.muted}
          style={[styles.searchInput, { color: c.text }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close" size={20} color={c.muted} />
          </Pressable>
        ) : null}
      </View>

      {!query ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.sm }}>
          {[FAV, MINE, ...CATEGORIES].map((cat) => {
            const active = cat === category;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[styles.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.card }]}>
                <T variant="small" color={active ? 'primary' : 'text'}>
                  {cat}
                </T>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {category === MINE && !query ? (
        showNew ? (
          <NewFood onDone={() => setShowNew(false)} />
        ) : (
          <Btn variant="secondary" icon="add" title="Kendi yemeğini ekle (etiketten)" onPress={() => setShowNew(true)} />
        )
      ) : null}

      <Card>
        {list.length === 0 ? (
          <T variant="muted">
            {query
              ? 'Bulunamadı. "Benim yemeklerim" bölümünden etiketteki değerle ekleyebilirsin.'
              : category === FAV
                ? 'Henüz favorin yok. Bir yemeğe dokunup yıldızla.'
                : 'Bu bölüm boş.'}
          </T>
        ) : (
          list.map((f) => (
            <Pressable key={f.id} onPress={() => setSelected(f)} style={({ pressed }) => [styles.foodRow, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <T>{f.name}</T>
                  {favorites.includes(f.id) ? <Ionicons name="star" size={14} color={c.warn} /> : null}
                </View>
                <T variant="small">
                  {f.portions[0].label} ({f.portions[0].grams} g) ≈ {fmt(carbsFor(f, f.portions[0].grams, method), 1)} g KH
                  {f.fatty ? ' · yağlı' : ''}
                  {f.fast ? ' · hızlı' : ''}
                </T>
              </View>
              <T variant="muted">{fmt(foodPer100(f, method))} g/100</T>
            </Pressable>
          ))
        )}
      </Card>
      <T variant="small" style={{ textAlign: 'center' }}>
        Değerler yaklaşıktır (100 g başına, lif hariç). Paketli ürünlerde etiketteki değeri kullan.
      </T>
    </Screen>
  );
}

function AddFood({
  food,
  onAdd,
  onClose,
  favorite,
  onToggleFavorite,
  onDelete,
}: {
  food: Food;
  onAdd: (grams: number) => void;
  onClose: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  onDelete?: () => void;
}) {
  const c = useTheme();
  const [portion, setPortion] = useState(0);
  const [count, setCount] = useState('1');
  const [gramText, setGramText] = useState('');
  const grams = parseNum(gramText) ?? (parseNum(count) ?? 0) * food.portions[portion].grams;
  const method = useSettings((s) => s.settings.countMethod);
  const carbs = carbsFor(food, grams, method);

  return (
    <Card
      title={food.name}
      icon="nutrition"
      style={{ borderColor: c.primary, borderWidth: 2 }}
      right={
        <Row gap={Space.md} style={{ alignItems: 'center' }}>
          <Pressable onPress={onToggleFavorite} hitSlop={10} accessibilityLabel="Favori">
            <Ionicons name={favorite ? 'star' : 'star-outline'} size={22} color={c.warn} />
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Kapat">
            <Ionicons name="close" size={24} color={c.muted} />
          </Pressable>
        </Row>
      }>
      <T variant="muted">
        100 g = {fmt(foodPer100(food, method))} g karbonhidrat ({method === 'exchange' ? 'değişim listesi' : 'gerçek bileşim'})
      </T>
      {food.meat && method === 'exchange' ? (
        <T variant="small">Öğünde toplam {MEAT_RULE_GRAMS} g üzeri et tüketirsen +{MEAT_RULE_CARBS} g KHO eklenir.</T>
      ) : null}
      <T variant="small">Bir porsiyona dokununca yemek tabağa eklenir. Farklı bir miktar için gram yaz.</T>
      <View style={styles.portions}>
        {food.portions.map((p, i) => {
          const active = i === portion && !gramText;
          return (
            <Pressable
              key={p.label}
              onPress={() => {
                // Porsiyona dokununca yemek (adet kadar) doğrudan tabağa eklenir; ayrıca onay gerekmez
                setPortion(i);
                setGramText('');
                onAdd(Math.round((parseNum(count) ?? 1) * p.grams));
              }}
              accessibilityLabel={`${p.label} ekle`}
              style={[styles.chip, { borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : 'transparent' }]}>
              <T variant="small" color={active ? 'primary' : 'text'}>
                {p.label} ({p.grams} g) · {fmt(carbsFor(food, p.grams, method), 1)} g KH
              </T>
            </Pressable>
          );
        })}
      </View>
      <Row>
        <Field label="Adet / porsiyon" value={count} onChangeText={(s) => { setCount(s); setGramText(''); }} />
        <Field label="veya gram" suffix="g" value={gramText} placeholder={fmt(grams, 0)} onChangeText={setGramText} />
      </Row>
      <View style={{ alignItems: 'center' }}>
        <T variant="big" color="primary">
          {fmt(carbs)} g
        </T>
        <T variant="small">karbonhidrat ({fmt(grams, 0)} g yiyecek)</T>
      </View>
      {food.fatty ? <Notice level="info" text="Yağlı/proteinli yiyecek: şeker geç yükselebilir." /> : null}
      <Btn title="Bu gramı tabağa ekle" icon="add-circle" disabled={!(grams > 0)} onPress={() => onAdd(Math.round(grams))} />
      {onDelete ? <Btn variant="ghost" icon="trash-outline" title="Bu yemeği sil" onPress={onDelete} /> : null}
    </Card>
  );
}

function NewFood({ onDone }: { onDone: () => void }) {
  const addCustomFood = useFoods((s) => s.addCustomFood);
  const [name, setName] = useState('');
  const [per100, setPer100] = useState('');
  const [portionLabel, setPortionLabel] = useState('1 porsiyon');
  const [portionGrams, setPortionGrams] = useState('');
  const [fatty, setFatty] = useState(false);
  const carbs = parseNum(per100);
  const pg = parseNum(portionGrams);
  const valid = name.trim() && carbs !== undefined && carbs >= 0 && carbs <= 100 && pg !== undefined && pg > 0;

  return (
    <Card title="Yeni yemek" icon="create-outline">
      <Field label="Ad" keyboard="text" value={name} onChangeText={setName} placeholder="ör. Annemin mantısı" />
      <Field label="100 g'daki karbonhidrat (etiketten)" suffix="g" value={per100} onChangeText={setPer100} />
      <Row>
        <Field label="Porsiyon adı" keyboard="text" value={portionLabel} onChangeText={setPortionLabel} />
        <Field label="Porsiyon ağırlığı" suffix="g" value={portionGrams} onChangeText={setPortionGrams} />
      </Row>
      <Toggle label="Yağlı / proteinli (geç yükseltir)" value={fatty} onChange={setFatty} />
      <Row>
        <Btn variant="ghost" title="Vazgeç" onPress={onDone} />
        <Btn
          title="Ekle"
          icon="checkmark"
          disabled={!valid}
          style={{ flexGrow: 1 }}
          onPress={() => {
            addCustomFood({
              name: name.trim(),
              category: MINE,
              carbsPer100: carbs!,
              portions: [{ label: portionLabel.trim() || '1 porsiyon', grams: pg! }],
              fatty: fatty || undefined,
            });
            onDone();
          }}
        />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  cartRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  search: { flexDirection: 'row', alignItems: 'center', gap: Space.sm, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Space.md },
  searchInput: { flex: 1, fontSize: 17, paddingVertical: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  portions: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
});
