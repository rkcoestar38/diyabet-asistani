import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** İnce ilerleme halkası; `progress` 0–1. İçine içerik konur. */
export function Ring({
  progress,
  size = 220,
  stroke = 10,
  tone = 'primary',
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  tone?: 'primary' | 'danger' | 'ok';
  children?: ReactNode;
}) {
  const c = useTheme();
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = useSharedValue(progress);
  useEffect(() => {
    p.value = reduce ? progress : withTiming(progress, { duration: 1000, easing: Easing.linear });
  }, [progress, reduce, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: circ * (1 - p.value) }));
  const color = tone === 'danger' ? c.danger : tone === 'ok' ? c.ok : c.primary;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.border} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circ}
          animatedProps={props}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}
