import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Pressy, T } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { mealAt, mealLabel } from '@/logic/meals';
import { activeCountdownMeal } from '@/logic/postmeal';
import type { LogEntry } from '@/logic/types';
import { useSettings } from '@/store/settings';

interface Props {
  entries: LogEntry[];
}

export function PostMealCountdownWidget({ entries }: Props) {
  const c = useTheme();
  const router = useRouter();
  const settings = useSettings((s) => s.settings);
  const [now, setNow] = useState(() => Date.now());

  // En son yenilen ve henüz tokluk şekeri girilmemiş yemek (son 4 saat içinde)
  const activeMeal = React.useMemo(() => activeCountdownMeal(entries, now), [entries, now]);

  // Aktif yemek varsa her saniye geri sayımı güncelle
  useEffect(() => {
    if (!activeMeal) return;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [activeMeal]);

  if (!activeMeal) return null;

  const elapsedMs = Math.max(0, now - activeMeal.time);
  const totalTargetMs = 120 * 60 * 1000; // 2 saat (120 dakika)
  const remainingMs = totalTargetMs - elapsedMs;
  const isOverdue = remainingMs <= 0;

  // İlerleme yüzdesi (0 - 120 dk arası)
  const progressRatio = Math.min(1, Math.max(0, elapsedMs / totalTargetMs));

  // Zaman formatlaması
  const formatTime = (ms: number) => {
    const totalSec = Math.floor(Math.abs(ms) / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const mealName = mealLabel(activeMeal.meal ?? mealAt(activeMeal.time, settings.mealStarts));
  const mealTimeStr = new Date(activeMeal.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isOverdue ? c.okBg : c.card,
          borderColor: isOverdue ? c.ok : c.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isOverdue ? c.card : c.cardAlt },
            ]}
          >
            <Ionicons
              name={isOverdue ? 'alarm' : 'time-outline'}
              size={18}
              color={isOverdue ? c.ok : c.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="label" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
              {isOverdue ? '2. SAAT TOKLUK VAKTİ' : '2. SAAT TOKLUK GERİ SAYIMI'}
            </T>
            <T variant="small" style={{ color: c.muted, marginTop: 1 }}>
              {mealName} · {mealTimeStr} ({activeMeal.carbs} g KH)
            </T>
          </View>
        </View>

        {/* Canlı Kalan Süre Sayacı */}
        <View
          style={[
            styles.timerBadge,
            {
              backgroundColor: isOverdue ? c.ok : c.cardAlt,
              borderColor: isOverdue ? c.ok : c.border,
            },
          ]}
        >
          <T
            variant="h2"
            style={[
              styles.timerText,
              { color: isOverdue ? '#ffffff' : c.primary },
            ]}
          >
            {isOverdue ? `+${formatTime(remainingMs)}` : formatTime(remainingMs)}
          </T>
        </View>
      </View>

      {/* İlerleme Çubuğu */}
      <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
        <View
          style={[
            styles.progressBar,
            {
              width: `${Math.round(progressRatio * 100)}%`,
              backgroundColor: isOverdue ? c.ok : c.primary,
            },
          ]}
        />
      </View>

      {/* Bilgi ve Eylem Alanı */}
      <View style={styles.actionRow}>
        <View style={styles.targetBadge}>
          <Ionicons name="shield-checkmark-outline" size={14} color={c.ok} />
          <T variant="small" style={{ color: c.ok, fontWeight: '700' }}>
            Hedef: &lt; {settings.postRange.high} mg/dL
          </T>
        </View>

        <Pressy
          onPress={() =>
            router.push({
              pathname: '/entry',
              params: { after: activeMeal.id, post: '1' },
            })
          }
          style={[
            styles.actionButton,
            { backgroundColor: isOverdue ? c.ok : c.primary },
          ]}
        >
          <Ionicons name="add-circle-outline" size={16} color="#ffffff" />
          <T variant="small" style={styles.actionButtonText}>
            Tokluk Şekerini Gir
          </T>
        </Pressy>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.md,
    gap: Space.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  timerText: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    fontSize: 16,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
