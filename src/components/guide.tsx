import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { EASE_OUT, Pressy, T, type IconName } from '@/components/ui';
import { Radius, Space, elevation, useScheme, useTheme } from '@/constants/theme';

/** Terimlerin sade açıklamaları; "?" ile açılır */
export const GLOSSARY = {
  icr: {
    title: 'Karbonhidrat oranı',
    text: '1 ünite hızlı insülinin kaç gram karbonhidratı karşıladığı. "1 Ü = 10 g" ise 60 g için 6 ünite vurursun. Sayı küçüldükçe daha çok insülin gerekir.',
  },
  isf: {
    title: 'Düzeltme faktörü',
    text: '1 ünitenin şekerini kaç mg/dL düşürdüğü. 40 ise ve şekerin 200, hedefin 120 ise: (200 − 120) ÷ 40 = 2 ünite düzeltme.',
  },
  target: {
    title: 'Hedef şeker',
    text: 'Uygulamanın düzeltme yaparken şekerini indirmeye çalıştığı değer. Genellikle 100–120 mg/dL. Hedef aralık ise "iyi" saydığımız alt ve üst sınırlar (ör. 80–140).',
  },
  iob: {
    title: 'Aktif insülin',
    text: 'Son birkaç saatte vurduğun ve hâlâ etki eden insülin. Uygulama bunu hesaba katar ki üst üste doz vurup şekerin düşmesin. Bu yüzden tüm dozlarını kaydetmen önemli.',
  },
  cob: {
    title: 'Aktif karbonhidrat',
    text: 'Yediğin ama henüz kana karışmamış karbonhidrat. Uygulama yemeklerin yaklaşık 3 saatte emildiğini varsayar.',
  },
  carbs: {
    title: 'Karbonhidrat sayma',
    text: 'Paket etiketinde "100 g’da karbonhidrat" yazar. Yediğin gramla çarpıp 100’e böl: 100 g’da 60 g yazan üründen 40 g yersen 60 × 40 ÷ 100 = 24 g karbonhidrat.',
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;

/** Başlık + yanında "?"; dokununca açıklama açılır */
export function Help({ term, label }: { term: GlossaryKey; label?: string }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const g = GLOSSARY[term];
  return (
    <View>
      <Pressable onPress={() => setOpen(!open)} style={styles.helpRow} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${g.title} nedir?`}>
        <T variant="label" style={{ marginBottom: 0 }}>
          {label ?? g.title}
        </T>
        <Ionicons name={open ? 'close-circle' : 'help-circle'} size={16} color={c.primary} />
      </Pressable>
      {open ? (
        <Animated.View entering={FadeInDown.duration(240).easing(EASE_OUT)} exiting={FadeOut.duration(120)} style={[styles.helpBox, { backgroundColor: c.infoBg }]}>
          <T variant="small" color="text">
            {g.text}
          </T>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Başlığına dokununca açılıp kapanan bölüm */
export function Collapsible({
  title,
  icon,
  children,
  initiallyOpen = false,
  open: controlledOpen,
  onToggle,
}: {
  title: string;
  icon?: IconName;
  children: ReactNode;
  initiallyOpen?: boolean;
  open?: boolean;
  onToggle?: (next: boolean) => void;
}) {
  const c = useTheme();
  const scheme = useScheme();
  const reduce = useReducedMotion();
  const isWeb = Platform.OS === 'web';
  const [internalOpen, setInternalOpen] = useState(initiallyOpen);
  const open = controlledOpen ?? internalOpen;
  const toggle = () => {
    if (onToggle) onToggle(!open);
    else setInternalOpen(!open);
  };
  if (isWeb) {
    return (
      <View style={[styles.coll, elevation(scheme), { backgroundColor: c.card, borderColor: scheme === 'dark' ? c.border : 'transparent' }]}>
        <Pressable onPress={toggle} style={styles.collHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
          {icon ? <Ionicons name={icon} size={18} color={c.primary} /> : null}
          <T variant="h2" style={{ flex: 1 }}>
            {title}
          </T>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} />
        </Pressable>
        {open ? <View style={{ gap: Space.md, marginTop: Space.md }}>{children}</View> : null}
      </View>
    );
  }
  return (
    <Animated.View layout={reduce ? undefined : LinearTransition.duration(260).easing(EASE_OUT)} style={[styles.coll, elevation(scheme), { backgroundColor: c.card, borderColor: scheme === 'dark' ? c.border : 'transparent' }]}>
      <Pressable onPress={toggle} style={styles.collHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        {icon ? <Ionicons name={icon} size={18} color={c.primary} /> : null}
        <T variant="h2" style={{ flex: 1 }}>
          {title}
        </T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={c.muted} />
      </Pressable>
      {open ? (
        <Animated.View entering={reduce ? undefined : FadeIn.duration(260)} style={{ gap: Space.md, marginTop: Space.md }}>
          {children}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

/** Büyük seçenek kartı (sihirbaz ve rehberler için) */
export function Choice({
  icon,
  title,
  text,
  onPress,
  selected,
}: {
  icon: IconName;
  title: string;
  text?: string;
  onPress: () => void;
  selected?: boolean;
}) {
  const c = useTheme();
  const scheme = useScheme();
  return (
    <Pressy
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.choice, elevation(scheme), { borderColor: selected ? c.primary : scheme === 'dark' ? c.border : 'transparent', backgroundColor: selected ? c.primarySoft : c.card }]}>
      <View style={[styles.choiceIcon, { backgroundColor: c.primarySoft }]}>
        <Ionicons name={icon} size={24} color={c.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="h2">{title}</T>
        {text ? <T variant="muted">{text}</T> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={c.muted} />
    </Pressy>
  );
}

/** Sihirbaz ilerleme noktaları */
export function StepDots({ step, total }: { step: number; total: number }) {
  const c = useTheme();
  return (
    <View style={styles.dots} accessibilityLabel={`Adım ${step + 1} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i <= step ? c.primary : c.border, width: i === step ? 22 : 8 }]} />
      ))}
    </View>
  );
}

/** Numaralı adım listesi */
export function Steps({ items }: { items: string[] }) {
  const c = useTheme();
  return (
    <View style={{ gap: Space.sm }}>
      {items.map((t, i) => (
        <View key={t} style={styles.stepRow}>
          <View style={[styles.stepNum, { backgroundColor: c.primarySoft }]}>
            <T variant="small" color="primary" style={{ fontWeight: '700' }}>
              {i + 1}
            </T>
          </View>
          <T style={{ flex: 1 }}>{t}</T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, alignSelf: 'flex-start' },
  helpBox: { borderRadius: Radius.sm, padding: Space.sm, marginBottom: Space.sm },
  coll: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: Space.lg },
  collHead: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  choice: { flexDirection: 'row', alignItems: 'center', gap: Space.md, borderWidth: 1.5, borderRadius: Radius.lg, padding: Space.lg },
  choiceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { height: 8, borderRadius: 4 },
  stepRow: { flexDirection: 'row', gap: Space.sm, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
