import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';

import { EASE_OUT } from '@/components/ui';
import { Font, Radius, useTheme } from '@/constants/theme';
import { useToast } from '@/store/toast';

const DURATION = 5000;

/** Ekranın altında beliren kısa bildirim; kendiliğinden kapanır, "Geri al" gibi bir eylem taşıyabilir. */
export function ToastHost() {
  const c = useTheme();
  const reduce = useReducedMotion();
  const toast = useToast((s) => s.toast);
  const hide = useToast((s) => s.hide);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(hide, toast.onAction ? DURATION : 3200);
    return () => clearTimeout(id);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Animated.View
        key={toast.id}
        entering={reduce ? undefined : FadeInDown.duration(280).easing(EASE_OUT)}
        exiting={reduce ? undefined : FadeOutDown.duration(180)}
        style={[styles.toast, { backgroundColor: c.text }]}
        accessibilityLiveRegion="polite">
        <Ionicons name="checkmark-circle" size={20} color={c.bg} />
        <Text style={[styles.text, { color: c.bg }]}>{toast.text}</Text>
        {toast.onAction ? (
          <Pressable
            onPress={() => {
              toast.onAction?.();
              hide();
            }}
            hitSlop={10}>
            <Text style={[styles.action, { color: c.primary }]}>{toast.actionLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: 0, right: 0, bottom: 84, alignItems: 'center', paddingHorizontal: 16 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.md, paddingVertical: 12, paddingHorizontal: 16, maxWidth: 520 },
  text: { flexShrink: 1, fontSize: 15, fontFamily: Font.semibold },
  action: { fontSize: 15, fontFamily: Font.extrabold },
});
