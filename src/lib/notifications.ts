import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as NotificationsModule from 'expo-notifications';
import { Platform } from 'react-native';

import { parseHHMM } from '@/logic/schedule';

/**
 * expo-notifications, Android'de Expo Go içinde içe aktarıldığı anda hata fırlatıyor (SDK 53+).
 * Bu yüzden modül yalnızca desteklenen ortamlarda (kalıcı kurulum / iOS Expo Go) yüklenir.
 */
const isExpoGoAndroid = Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const notificationsSupported = Platform.OS !== 'web' && !isExpoGoAndroid;

/** Bildirim desteklenmediğinde kullanıcıya gösterilecek açıklama */
export const notificationsUnsupportedReason =
  Platform.OS === 'web'
    ? 'Bildirimler tarayıcıda çalışmaz; telefonda çalışır.'
    : 'Bildirimler Android Expo Go içinde çalışmaz; uygulamanın kalıcı kurulumunda (APK) çalışır.';

let cached: typeof NotificationsModule | undefined;
function load(): typeof NotificationsModule | undefined {
  if (!notificationsSupported) return undefined;
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as typeof NotificationsModule;
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return cached;
}

async function ensurePermission(N: typeof NotificationsModule): Promise<boolean> {
  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync('hatirlatici', {
      name: 'Hatırlatıcılar',
      importance: N.AndroidImportance.HIGH,
    });
  }
  const current = await N.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

/** Hipo sonrası "tekrar ölç" hatırlatıcısı. Bildirim kimliğini döndürür. */
export async function scheduleRecheck(minutes: number): Promise<string | undefined> {
  const N = load();
  if (!N || !(await ensurePermission(N))) return undefined;
  return N.scheduleNotificationAsync({
    content: { title: 'Şekerini tekrar ölç', body: `${minutes} dakika doldu. Şekerini ölç ve uygulamaya gir.` },
    trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: 'hatirlatici' },
  });
}

export async function cancelNotification(id: string | undefined) {
  const N = load();
  if (N && id) await N.cancelScheduledNotificationAsync(id);
}

const BASAL_ID = 'bazal-hatirlatici';

/** Günlük bazal insülin hatırlatıcısını kurar veya kaldırır. Başarılıysa true. */
export async function syncBasalReminder(enabled: boolean, time: string, name: string): Promise<boolean> {
  const N = load();
  if (!N) return false;
  await N.cancelScheduledNotificationAsync(BASAL_ID).catch(() => {});
  if (!enabled) return true;
  const m = parseHHMM(time);
  if (Number.isNaN(m) || !(await ensurePermission(N))) return false;
  await N.scheduleNotificationAsync({
    identifier: BASAL_ID,
    content: { title: 'Bazal insülin zamanı', body: `${name || 'Bazal insülinini'} vurmayı unutma ve uygulamaya kaydet.` },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DAILY,
      hour: Math.floor(m / 60),
      minute: m % 60,
      channelId: 'hatirlatici',
    },
  });
  return true;
}
