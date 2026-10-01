import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Font, Radius, Space, elevation, useScheme, useTheme, type Palette } from '@/constants/theme';
import { formatDateInput, formatTimeInput, numToInput } from '@/lib/input';
import type { Warning } from '@/logic/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** "7,5" veya "7.5" → 7.5; boş/geçersiz → undefined */
export function parseNum(s: string): number | undefined {
  const t = s.trim().replace(',', '.');
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Hafif dokunuş geri bildirimi (web'de sessizce atlanır) */
export function tap(kind: 'light' | 'success' | 'warning' = 'light') {
  if (Platform.OS === 'web') return;
  if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  else Haptics.notificationAsync(kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning).catch(() => {});
}

/** İçeriği aşağıdan hafifçe süzülerek (kademeli) getirir; hareket azaltma açıksa anında gösterir. */
export function Reveal({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  const reduce = useReducedMotion();
  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.delay(Math.min(index, 8) * 45).duration(420).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 14 }] })}
      layout={reduce ? undefined : LinearTransition.duration(260).easing(EASE_OUT)}
      style={style}>
      {children}
    </Animated.View>
  );
}

/** Basınca yay gibi küçülen/dönen Pressable */
export function Pressy({
  children,
  onPress,
  disabled,
  style,
  scale = 0.97,
  haptic = true,
  ...rest
}: {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  scale?: number;
  haptic?: boolean;
} & Omit<ComponentProps<typeof Pressable>, 'style' | 'children' | 'onPress'>) {
  const s = useSharedValue(1);
  const reduce = useReducedMotion();
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
      onPressIn={() => {
        if (!reduce) s.set(withSpring(scale, { damping: 18, stiffness: 420 }));
      }}
      onPressOut={() => {
        if (!reduce) s.set(withSpring(1, { damping: 12, stiffness: 260 }));
      }}>
      <Animated.View style={[anim, style]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Sayıyı eski değerden yenisine akıcı sayar */
export function useCountUp(target: number, ms = 650, decimals = 1) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    const from = current.current;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const p = reduce ? 1 : Math.min(1, (Date.now() - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 4);
      current.current = from + (target - from) * eased;
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  const f = 10 ** decimals;
  return Math.round(shown * f) / f;
}

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useTheme();
  if (!scroll) return <View style={[styles.screen, { backgroundColor: c.bg }]}>{children}</View>;
  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}>
      <View style={styles.maxWidth}>
        {Children.toArray(children).map((child, i) => (
          <Reveal key={isValidElement(child) && child.key != null ? child.key : i} index={i}>
            {child}
          </Reveal>
        ))}
      </View>
    </ScrollView>
  );
}

export function Card({
  title,
  icon,
  right,
  children,
  style,
  tone,
}: {
  title?: string;
  icon?: IconName;
  right?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'soft';
}) {
  const c = useTheme();
  const scheme = useScheme();
  return (
    <View
      style={[
        styles.card,
        elevation(scheme),
        { backgroundColor: tone === 'soft' ? c.primarySoft : c.card, borderColor: scheme === 'dark' ? c.border : 'transparent' },
        style,
      ]}>
      {title ? (
        <View style={styles.cardHeader}>
          {icon ? (
            <View style={[styles.iconBadge, { backgroundColor: c.primarySoft }]}>
              <Ionicons name={icon} size={16} color={c.primary} />
            </View>
          ) : null}
          <T variant="h2" style={{ flex: 1 }}>
            {title}
          </T>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
}

type Variant = 'title' | 'h2' | 'body' | 'muted' | 'small' | 'big' | 'label';

const WEIGHT_TO_FONT: Record<string, string> = {
  '400': Font.regular,
  normal: Font.regular,
  '500': Font.medium,
  '600': Font.semibold,
  '700': Font.bold,
  bold: Font.bold,
  '800': Font.extrabold,
  '900': Font.extrabold,
};

export function T({
  children,
  variant = 'body',
  color,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: Variant;
  color?: keyof Palette;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const c = useTheme();
  const base = textStyles[variant];
  const defaultColor = variant === 'muted' || variant === 'small' || variant === 'label' ? c.muted : c.text;
  const flat = StyleSheet.flatten(style) ?? {};
  // Özel yazı tiplerinde fontWeight çalışmaz: ağırlığı doğru aile adına çevir
  const family = flat.fontWeight ? (WEIGHT_TO_FONT[String(flat.fontWeight)] ?? base.fontFamily) : base.fontFamily;
  const { fontWeight: _fw, ...rest } = flat;
  return (
    <Text numberOfLines={numberOfLines} style={[base, { color: color ? c[color] : defaultColor }, rest, { fontFamily: family }]}>
      {children}
    </Text>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  suffix,
  placeholder,
  keyboard = 'decimal',
  big,
  style,
  autoFocus,
  step,
  min = 0,
  max,
  base = 0,
  align,
}: {
  label?: string;
  value: string;
  onChangeText: (s: string) => void;
  suffix?: string;
  placeholder?: string;
  keyboard?: 'decimal' | 'text' | 'number';
  big?: boolean;
  style?: StyleProp<ViewStyle>;
  autoFocus?: boolean;
  /** Verilirse alanın iki yanında −/+ düğmeleri çıkar */
  step?: number;
  min?: number;
  max?: number;
  /** Alan boşken ilk + / − bu değerden başlar */
  base?: number;
  align?: 'left' | 'center';
}) {
  const c = useTheme();
  const [focus, setFocus] = useState(false);
  const inRow = useContext(InRow);
  const nudge = (delta: number) => {
    const cur = parseNum(value) ?? base;
    let next = Math.round((cur + delta) * 100) / 100;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    onChangeText(numToInput(next));
  };
  return (
    <View style={[inRow && styles.fieldInRow, style]}>
      {label ? <T variant="label">{label}{suffix && step ? ` (${suffix})` : ''}</T> : null}
      <View
        style={[
          styles.inputWrap,
          { borderColor: focus ? c.primary : c.border, backgroundColor: focus ? c.card : c.cardAlt, borderWidth: focus ? 2 : 1.5 },
        ]}>
        {step ? <StepBtn icon="remove" onPress={() => nudge(-step)} label="Azalt" /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder ?? (step ? '0' : undefined)}
          placeholderTextColor={c.muted}
          selectionColor={c.primary}
          cursorColor={c.primary}
          autoFocus={autoFocus}
          keyboardType={keyboard === 'decimal' ? 'decimal-pad' : keyboard === 'number' ? 'number-pad' : 'default'}
          selectTextOnFocus
          returnKeyType="done"
          style={[styles.input, big && styles.inputBig, { color: c.text, fontFamily: big ? Font.extrabold : Font.semibold, textAlign: step || align === 'center' ? 'center' : 'left' }, webInput]}
          accessibilityLabel={label}
        />
        {suffix && !step ? <T variant="muted">{suffix}</T> : null}
        {step ? <StepBtn icon="add" onPress={() => nudge(step)} label="Artır" /> : null}
      </View>
    </View>
  );
}

// Web'de odak halkasını tema renginden çiz (tarayıcı varsayılanı yerine)
const webInput = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

function StepBtn({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  const c = useTheme();
  return (
    <Pressy onPress={onPress} scale={0.88} accessibilityLabel={label} accessibilityRole="button" style={[styles.stepBtn, { backgroundColor: c.primarySoft }]}>
      <Ionicons name={icon} size={18} color={c.primary} />
    </Pressy>
  );
}

/** Saat alanı: rakamları yaz, ":" kendiliğinden gelir (örn. 1745 → 17:45). */
export function TimeField({ label, value, onChange, style }: { label?: string; value: string; onChange: (s: string) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Field
      label={label}
      value={value}
      placeholder="SS:DD"
      keyboard="number"
      align="center"
      style={style}
      onChangeText={(s) => onChange(formatTimeInput(s))}
    />
  );
}

/** Tarih alanı: rakamları yaz, noktalar kendiliğinden gelir (örn. 01102026 → 01.10.2026). */
export function DateField({ label, value, onChange, style }: { label?: string; value: string; onChange: (s: string) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Field
      label={label}
      value={value}
      placeholder="GG.AA.YYYY"
      keyboard="number"
      align="center"
      style={style}
      onChangeText={(s) => onChange(formatDateInput(s))}
    />
  );
}

export function Btn({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'dangerSoft' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useTheme();
  const bg = { primary: c.primary, secondary: c.primarySoft, danger: c.danger, dangerSoft: c.dangerBg, ghost: 'transparent' }[variant];
  const fg = { primary: c.onPrimary, secondary: c.primary, danger: c.onDanger, dangerSoft: c.danger, ghost: c.primary }[variant];
  return (
    <Pressy
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      scale={0.96}
      style={[styles.btn, small && styles.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }, style]}>
      {icon ? <Ionicons name={icon} size={small ? 16 : 20} color={fg} /> : null}
      <Text style={[styles.btnText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
    </Pressy>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const c = useTheme();
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  const itemW = w > 0 ? (w - 6) / options.length : 0;
  useEffect(() => {
    x.value = reduce ? idx * itemW : withTiming(idx * itemW, { duration: 260, easing: EASE_OUT });
  }, [idx, itemW, reduce, x]);
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[styles.segment, { backgroundColor: c.primarySoft }]}>
      {itemW > 0 ? <Animated.View style={[styles.segmentPill, { width: itemW, backgroundColor: c.card }, pill]} /> : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!active) tap();
              onChange(o.value);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={styles.segmentItem}>
            <Text style={[styles.segmentText, { color: active ? c.primary : c.muted, fontFamily: active ? Font.bold : Font.semibold }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Notice({ level, text, style }: Warning & { style?: StyleProp<ViewStyle> }) {
  const c = useTheme();
  const reduce = useReducedMotion();
  const map = {
    danger: { bg: c.dangerBg, fg: c.danger, icon: 'alert-circle' as const },
    warn: { bg: c.warnBg, fg: c.warn, icon: 'warning' as const },
    info: { bg: c.infoBg, fg: c.info, icon: 'information-circle' as const },
  }[level];
  return (
    <Animated.View
      entering={reduce ? undefined : FadeInDown.duration(320).easing(EASE_OUT)}
      exiting={reduce ? undefined : FadeOut.duration(160)}
      style={[styles.notice, { backgroundColor: map.bg }, style]}
      accessibilityRole={level === 'danger' ? 'alert' : undefined}>
      <Ionicons name={map.icon} size={20} color={map.fg} style={{ marginTop: 1 }} />
      <Text style={[styles.noticeText, { color: c.text }]}>{text}</Text>
    </Animated.View>
  );
}

/** Satır içindeki alanlar eşit genişlikte yan yana dizilir, dar ekranda alta kayar */
const InRow = createContext(false);

/** Bileşen bir Row içinde mi? (yatayda esneme yalnızca satırlarda uygulanır) */
export const useInRow = () => useContext(InRow);

export function Row({ children, gap = Space.sm, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <InRow.Provider value>
      <View style={[{ flexDirection: 'row', gap, alignItems: 'flex-end', flexWrap: 'wrap' }, style]}>{children}</View>
    </InRow.Provider>
  );
}

export function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  const c = useTheme();
  return (
    <View style={[styles.kv, { borderColor: c.border }]}>
      <T variant={strong ? 'body' : 'muted'} style={{ flex: 1 }}>
        {k}
      </T>
      <T style={{ fontWeight: strong ? '700' : '600', fontVariant: ['tabular-nums'] }}>{v}</T>
    </View>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const c = useTheme();
  const reduce = useReducedMotion();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = reduce ? (value ? 1 : 0) : withSpring(value ? 1 : 0, { damping: 16, stiffness: 300 });
  }, [value, reduce, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 20 }] }));
  return (
    <Pressy onPress={() => onChange(!value)} scale={0.99} style={styles.toggle} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={[styles.track, { backgroundColor: value ? c.primary : c.border }]}>
        <Animated.View style={[styles.knob, { backgroundColor: value ? c.onPrimary : c.card }, knob]} />
      </View>
      <T style={{ flex: 1 }}>{label}</T>
    </Pressy>
  );
}

/** Platformdan bağımsız onay penceresi */
export function confirm(title: string, message: string, onOk: () => void, okText = 'Tamam') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Vazgeç', style: 'cancel' },
    { text: okText, onPress: onOk },
  ]);
}

export function notify(title: string, message: string) {
  tap('success');
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

const textStyles = StyleSheet.create({
  title: { fontSize: 26, lineHeight: 32, fontFamily: Font.extrabold, letterSpacing: -0.4 },
  h2: { fontSize: 17, lineHeight: 23, fontFamily: Font.bold, letterSpacing: -0.1 },
  body: { fontSize: 16, lineHeight: 23, fontFamily: Font.regular },
  muted: { fontSize: 15, lineHeight: 21, fontFamily: Font.regular },
  small: { fontSize: 13, lineHeight: 18, fontFamily: Font.regular },
  label: { fontSize: 13, lineHeight: 17, fontFamily: Font.semibold, marginBottom: 6 },
  big: { fontSize: 56, lineHeight: 62, fontFamily: Font.extrabold, letterSpacing: -1.2, fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fieldInRow: { flexGrow: 1, flexBasis: 0, minWidth: 130 },
  screenContent: { padding: Space.lg, paddingBottom: 56 },
  maxWidth: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: Space.md },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: Space.lg, gap: Space.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  iconBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    gap: Space.sm,
  },
  input: { flex: 1, fontSize: 18, paddingVertical: 11, minWidth: 40 },
  inputBig: { fontSize: 30, paddingVertical: 8 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    borderRadius: Radius.md,
    paddingVertical: 15,
    paddingHorizontal: Space.lg,
  },
  btnSmall: { paddingVertical: 9, paddingHorizontal: Space.md },
  btnText: { fontSize: 16, fontFamily: Font.bold, letterSpacing: 0.1 },
  segment: { flexDirection: 'row', borderRadius: Radius.md, padding: 3 },
  segmentPill: { position: 'absolute', top: 3, left: 3, bottom: 3, borderRadius: Radius.md - 3 },
  segmentItem: { flex: 1, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, textAlign: 'center' },
  notice: { flexDirection: 'row', gap: Space.sm, padding: Space.md, borderRadius: Radius.md },
  noticeText: { flex: 1, fontSize: 15, lineHeight: 21, fontFamily: Font.medium },
  kv: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: Space.md },
  stepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: Space.md, paddingVertical: 6 },
  track: { width: 48, height: 28, borderRadius: 14, justifyContent: 'center', paddingHorizontal: 4 },
  knob: { width: 20, height: 20, borderRadius: 10 },
});

