import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Btn, Card, Field, Notice, Row, Screen, T, Toggle, confirm, parseNum } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import {
  CATEGORIES,
  FOODS,
  MEAT_RULE_CARBS,
  MEAT_RULE_GRAMS,
  PORTION_CATEGORY_LABELS,
  carbsFor,
  getPortionCategory,
  normalize,
  per100 as foodPer100,
  type Food,
  type Portion,
  type PortionCategory,
} from '@/data/foods-tr';
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
  const {
    customFoods,
    favorites,
    meals,
    cart,
    toggleFavorite,
    addToCart,
    updateCartGrams,
    removeFromCart,
    clearCart,
    saveMeal,
    loadMeal,
    removeMeal,
    removeCustomFood,
  } = useFoods();
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
        {!picker ? (
          <>
            <MealChips value={when.meal} auto={when.isAuto} onChange={(m) => setDraft({ meal: m })} />
            <SameAsBefore meal={when.meal} before={when.doseTime} />
          </>
        ) : null}
        {cart.length === 0 ? (
          <T variant="muted">Aşağıdan yemek seç; boyut, porsiyon veya gram belirle. Toplam, Hesapla ekranına aktarılır.</T>
        ) : (
          <>
            {cart.map((i) => {
              const step = i.portionGrams && i.portionGrams <= 50 ? i.portionGrams : 10;
              return (
                <View key={i.id} style={[styles.cartRow, { borderColor: c.border }]}>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontWeight: '600' }}>{i.name}</T>
                    <T variant="small" color="muted">
                      {fmt(i.carbs)} g KH {i.portionLabel ? `· ${i.portionLabel}` : ''}
                    </T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable
                      onPress={() => {
                        if (i.grams <= step) removeFromCart(i.id);
                        else updateCartGrams(i.id, Math.max(0, i.grams - step));
                      }}
                      hitSlop={8}
                      accessibilityLabel={`${i.name} ${step} gram azalt`}
                      style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="remove" size={16} color={c.text} />
                    </Pressable>
                    <T style={{ minWidth: 48, textAlign: 'center', fontWeight: '700' }}>
                      {fmt(i.grams, 0)} g
                    </T>
                    <Pressable
                      onPress={() => updateCartGrams(i.id, i.grams + step)}
                      hitSlop={8}
                      accessibilityLabel={`${i.name} ${step} gram artır`}
                      style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="add" size={16} color={c.text} />
                    </Pressable>
                  </View>
                  <Pressable onPress={() => removeFromCart(i.id)} hitSlop={10} accessibilityLabel={`${i.name} çıkar`}>
                    <Ionicons name="close-circle" size={22} color={c.muted} />
                  </Pressable>
                </View>
              );
            })}
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
              <Field
                label="Bu tabağı sık yenen şablon olarak kaydet"
                keyboard="text"
                placeholder="ör. Favori Kahvaltım"
                value={mealName}
                onChangeText={setMealName}
              />
              <Btn
                small
                variant="secondary"
                icon="bookmark-outline"
                title="Şablon olarak kaydet"
                disabled={!mealName.trim()}
                onPress={() => {
                  saveMeal(mealName.trim());
                  toast(`“${mealName.trim()}” şablonu kaydedildi`);
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
        <Card title="Kayıtlı tabak şablonları" icon="bookmark">
          {meals.map((m) => (
            <View key={m.id} style={[styles.cartRow, { borderColor: c.border }]}>
              <Pressable style={{ flex: 1 }} onPress={() => loadMeal(m.id)}>
                <T>{m.name}</T>
                <T variant="small">
                  {cartTotal(m.items)} g · {m.items.map((i) => i.name).join(', ')}
                </T>
              </Pressable>
              <Btn small variant="secondary" title="Tabağa koy" onPress={() => loadMeal(m.id)} />
              <Pressable onPress={() => confirm('Şablonu sil', `"${m.name}" şablonu silinsin mi?`, () => removeMeal(m.id), 'Sil')} hitSlop={10}>
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
          onAdd={(grams, portionLabel, portionGrams) => {
            const item = {
              foodId: selected.id,
              name: selected.name,
              grams,
              carbs: carbsFor(selected, grams, method),
              fatty: selected.fatty,
              meat: selected.meat,
              portionLabel,
              portionGrams,
            };
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
          placeholder="Yemek ara (ör. simit, elma, pilav)"
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
        <View style={styles.categoryGrid}>
          {[FAV, MINE, ...CATEGORIES].map((cat) => {
            const active = cat === category;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.categoryGridTile,
                  {
                    borderColor: active ? c.primary : c.border,
                    backgroundColor: active ? c.primarySoft : c.card,
                  },
                ]}>
                <T
                  variant="small"
                  numberOfLines={1}
                  style={{
                    fontWeight: active ? '700' : '500',
                    color: active ? c.primary : c.text,
                    textAlign: 'center',
                  }}>
                  {cat}
                </T>
              </Pressable>
            );
          })}
        </View>
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
                  {f.portions.length > 1 ? ` · ${f.portions.length} farklı porsiyon` : ''}
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
        Değerler TürKomp ve TÜBER 2022 standartlarına uygundur (lif hariç). Paketli ürünlerde etiketteki değeri kullanın.
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
  onAdd: (grams: number, portionLabel?: string, portionGrams?: number) => void;
  onClose: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  onDelete?: () => void;
}) {
  const c = useTheme();
  const method = useSettings((s) => s.settings.countMethod);

  // Porsiyon kategorilerini tespit et
  const categoriesInFood = useMemo(() => {
    const cats = new Set<PortionCategory>();
    for (const p of food.portions) {
      cats.add(getPortionCategory(p));
    }
    return Array.from(cats);
  }, [food.portions]);

  const [filterCat, setFilterCat] = useState<string>('all');
  const [portionIndex, setPortionIndex] = useState(0);
  const [multiplier, setMultiplier] = useState('1');
  const [gramText, setGramText] = useState('');

  // Filtrelenmiş porsiyon listesi
  const filteredPortions = useMemo(() => {
    if (filterCat === 'all') return food.portions;
    return food.portions.filter((p) => getPortionCategory(p) === filterCat);
  }, [food.portions, filterCat]);

  // Seçili porsiyon (orijinal dizideki veya filtrelenendeki)
  const currentPortion: Portion = food.portions[portionIndex] ?? food.portions[0];

  // Gramaj hesabı: Kullanıcı doğrudan gram kutusuna değer girdiyse o; aksi halde (çarpan * porsiyon gramı)
  const isDirectGram = Boolean(gramText.trim());
  const parsedCount = parseNum(multiplier) ?? 1;
  const calculatedGrams = isDirectGram
    ? (parseNum(gramText) ?? 0)
    : Math.round(parsedCount * currentPortion.grams);

  const carbs = carbsFor(food, calculatedGrams, method);

  const handleSelectPortion = (p: Portion) => {
    const originalIdx = food.portions.findIndex((x) => x.label === p.label && x.grams === p.grams);
    if (originalIdx >= 0) setPortionIndex(originalIdx);
    setGramText(''); // Gram text'i sıfırlayıp porsiyon hesabına dön
  };

  const handleStepMultiplier = (delta: number) => {
    const current = parseNum(multiplier) ?? 1;
    const next = Math.max(0.5, Math.round((current + delta) * 2) / 2);
    setMultiplier(String(next));
    setGramText('');
  };

  const handleConfirmAdd = () => {
    if (calculatedGrams <= 0) return;
    const label = isDirectGram
      ? `${calculatedGrams} g`
      : `${parsedCount > 1 ? `${parsedCount}x ` : ''}${currentPortion.label} (${calculatedGrams} g)`;
    onAdd(calculatedGrams, label, currentPortion.grams);
  };

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
        100 g = {fmt(foodPer100(food, method))} g karbonhidrat ({method === 'exchange' ? 'TÜBER değişim listesi' : 'TürKomp gerçek bileşim'})
      </T>
      {food.meat && method === 'exchange' ? (
        <T variant="small">Öğünde toplam {MEAT_RULE_GRAMS} g üzeri et tüketirsen +{MEAT_RULE_CARBS} g KHO eklenir.</T>
      ) : null}

      {/* Porsiyon Kategorisi Sekmeleri (Varsa) */}
      {categoriesInFood.length > 1 ? (
        <View style={{ marginTop: 4 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Space.xs }}>
            <Pressable
              onPress={() => setFilterCat('all')}
              style={[
                styles.categoryFilterChip,
                {
                  backgroundColor: filterCat === 'all' ? c.primary : c.cardAlt,
                  borderColor: filterCat === 'all' ? c.primary : c.border,
                },
              ]}>
              <T variant="small" style={{ color: filterCat === 'all' ? c.onPrimary : c.text, fontWeight: '600' }}>
                Tüm Seçenekler
              </T>
            </Pressable>
            {categoriesInFood.map((catKey) => {
              const active = filterCat === catKey;
              return (
                <Pressable
                  key={catKey}
                  onPress={() => setFilterCat(catKey)}
                  style={[
                    styles.categoryFilterChip,
                    {
                      backgroundColor: active ? c.primary : c.cardAlt,
                      borderColor: active ? c.primary : c.border,
                    },
                  ]}>
                  <T variant="small" style={{ color: active ? c.onPrimary : c.text, fontWeight: '600' }}>
                    {PORTION_CATEGORY_LABELS[catKey]}
                  </T>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* Porsiyon Kartları / Çipler */}
      <View style={styles.portionSection}>
        <T variant="small" style={{ fontWeight: '600' }}>
          Porsiyon / Boyut Seç:
        </T>
        <View style={styles.portions}>
          {filteredPortions.map((p) => {
            const isSelected = p.label === currentPortion.label && p.grams === currentPortion.grams && !isDirectGram;
            const singleCarb = carbsFor(food, p.grams, method);
            return (
              <Pressable
                key={`${p.label}-${p.grams}`}
                onPress={() => handleSelectPortion(p)}
                accessibilityLabel={`${p.label} seç`}
                style={[
                  styles.portionCard,
                  {
                    borderColor: isSelected ? c.primary : c.border,
                    backgroundColor: isSelected ? c.primarySoft : c.cardAlt,
                  },
                ]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <T style={{ fontWeight: isSelected ? '700' : '500', fontSize: 13, color: isSelected ? c.primary : c.text }}>
                    {p.label}
                  </T>
                  {isSelected ? <Ionicons name="checkmark-circle" size={14} color={c.primary} /> : null}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                  <T variant="small" color="muted">
                    {p.grams} g
                  </T>
                  <T variant="small" style={{ fontWeight: '600', color: isSelected ? c.primary : c.text }}>
                    {fmt(singleCarb, 1)} g KH
                  </T>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Miktar Stepper & Serbest Gram Girişi */}
      <View style={{ gap: Space.sm, marginTop: 4 }}>
        <Row gap={Space.sm} style={{ alignItems: 'flex-end' }}>
          {/* Adet / Çarpan Stepper */}
          <View style={{ flex: 1 }}>
            <T variant="small" color="muted" style={{ marginBottom: 4 }}>
              Adet / Miktar
            </T>
            <View style={[styles.stepperContainer, { borderColor: c.border, backgroundColor: c.cardAlt }]}>
              <Pressable
                onPress={() => handleStepMultiplier(-0.5)}
                hitSlop={6}
                accessibilityLabel="Adet azalt"
                style={styles.stepperBtn}>
                <Ionicons name="remove" size={18} color={c.text} />
              </Pressable>
              <TextInput
                value={multiplier}
                onChangeText={(s) => {
                  setMultiplier(s);
                  setGramText('');
                }}
                keyboardType="decimal-pad"
                style={[styles.stepperInput, { color: c.text }]}
              />
              <Pressable
                onPress={() => handleStepMultiplier(0.5)}
                hitSlop={6}
                accessibilityLabel="Adet artır"
                style={styles.stepperBtn}>
                <Ionicons name="add" size={18} color={c.text} />
              </Pressable>
            </View>
          </View>

          {/* Serbest Gram Kutusu */}
          <View style={{ flex: 1 }}>
            <Field
              label="veya Net Gramaj"
              suffix="g"
              keyboard="decimal"
              value={gramText}
              placeholder={String(calculatedGrams)}
              onChangeText={setGramText}
            />
          </View>
        </Row>
      </View>

      {/* Büyük Canlı Sonuç */}
      <View style={[styles.resultBox, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
        <T variant="big" color="primary">
          {fmt(carbs, 1)} g
        </T>
        <T variant="small" style={{ fontWeight: '600', color: c.text }}>
          karbonhidrat · {calculatedGrams} g yiyecek
        </T>
        <T variant="small" color="muted">
          {isDirectGram
            ? 'Terazi gramajı girildi'
            : `${multiplier} x ${currentPortion.label}`}
        </T>
      </View>

      {food.fatty ? <Notice level="info" text="Yağlı/proteinli yiyecek: şeker geç yükselebilir." /> : null}

      <Btn
        title={`Bu Miktarı Tabağa Ekle (${fmt(carbs, 1)} g KH)`}
        icon="add-circle"
        disabled={!(calculatedGrams > 0)}
        onPress={handleConfirmAdd}
      />
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
  categoryFilterChip: { borderWidth: 1, borderRadius: Radius.sm, paddingVertical: 5, paddingHorizontal: 10 },
  portionSection: { gap: Space.xs, marginTop: Space.xs },
  portions: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.xs },
  portionCard: { borderWidth: 1.5, borderRadius: Radius.sm, paddingVertical: 6, paddingHorizontal: 10, minWidth: '47%', flexGrow: 1 },
  stepperContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, height: 48, overflow: 'hidden' },
  stepperBtn: { width: 40, height: 48, alignItems: 'center', justifyContent: 'center' },
  stepperInput: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', paddingVertical: 0 },
  resultBox: { alignItems: 'center', paddingVertical: Space.sm, borderRadius: Radius.md, borderWidth: 1, marginVertical: 2 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.xs, marginVertical: Space.xs },
  categoryGridTile: { width: '48%', flexGrow: 1, borderWidth: 1.5, borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
});
