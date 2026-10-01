import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Radius, useScheme, useTheme } from '@/constants/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Sinüs dalgası yolu: `level` 0–1 (doluluk), `phase` radyan */
function wavePath(w: number, h: number, level: number, phase: number, amp: number, k: number) {
  'worklet';
  if (w <= 0) return 'M0 0';
  const base = h * (1 - level);
  let d = `M0 ${h} L0 ${base + Math.sin(phase) * amp}`;
  const steps = 24;
  for (let i = 1; i <= steps; i++) {
    const x = (w / steps) * i;
    d += ` L${x} ${base + Math.sin(phase + (x / w) * k * Math.PI * 2) * amp}`;
  }
  return `${d} L${w} ${h} Z`;
}

/**
 * Su seviyesi kartı: arka planda iki yavaş dalga, `level` değişince su yükselir/alçalır.
 * Hareket azaltma açıksa dalga durur, seviye anında değişir.
 */
export function WaterLevel({
  level,
  height = 150,
  children,
  tone = 'primary',
}: {
  level: number;
  height?: number;
  children: ReactNode;
  tone?: 'primary' | 'danger';
}) {
  const c = useTheme();
  const scheme = useScheme();
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const lvl = useSharedValue(level);
  const ph = useSharedValue(0);

  useEffect(() => {
    const clamped = Math.min(1, Math.max(0.1, level));
    lvl.value = reduce ? clamped : withTiming(clamped, { duration: 1100, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  }, [level, reduce, lvl]);

  useEffect(() => {
    if (reduce) return;
    ph.value = 0;
    ph.value = withRepeat(withTiming(Math.PI * 2, { duration: 9000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(ph);
  }, [reduce, ph]);

  const back = useAnimatedProps(() => ({ d: wavePath(w, height, lvl.value + 0.04, ph.value + 1.3, 5, 1.3) }));
  const front = useAnimatedProps(() => ({ d: wavePath(w, height, lvl.value, -ph.value, 7, 1) }));

  const color = tone === 'danger' ? c.danger : c.waterDeep;
  const frontOpacity = scheme === 'dark' ? 0.42 : 0.3;

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={[styles.wrap, { height, backgroundColor: c.card, borderColor: scheme === 'dark' ? c.border : 'transparent' }]}>
      {w > 0 ? (
        <Svg width={w} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="g" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={frontOpacity} />
              <Stop offset="1" stopColor={color} stopOpacity={frontOpacity + 0.18} />
            </LinearGradient>
          </Defs>
          <AnimatedPath animatedProps={back} fill={color} fillOpacity={0.14} />
          <AnimatedPath animatedProps={front} fill="url(#g)" />
        </Svg>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1 },
  content: { flex: 1, padding: 16, justifyContent: 'space-between' },
});
