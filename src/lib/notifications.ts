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

const RECHECK_ID = 'hipo-tekrar-hatirlatici';

/** Hipo sonrası "tekrar ölç" hatırlatıcısı. Sabit kimlikle kurulur: yeni tur eskisinin yerine geçer. Bildirim kimliğini döndürür. */
export async function scheduleRecheck(minutes: number): Promise<string | undefined> {
  const N = load();
  if (!N || !(await ensurePermission(N))) return undefined;
  await N.cancelScheduledNotificationAsync(RECHECK_ID).catch(() => {});
  await N.scheduleNotificationAsync({
    identifier: RECHECK_ID,
    content: { title: 'Şekerini tekrar ölç', body: `${minutes} dakika doldu. Şekerini ölç ve uygulamaya gir.` },
    trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60, channelId: 'hatirlatici' },
  });
  return RECHECK_ID;
}

export async function cancelNotification(id: string | undefined) {
  const N = load();
  if (N && id) await N.cancelScheduledNotificationAsync(id);
}

const POST_MEAL_ID = 'tokluk-hatirlatici';

/**
 * Yemekten 2 saat sonra tokluk şekeri ölçüm hatırlatıcısı kurar.
 * `mealTime` verilirse öğün saatinden itibaren sayar (geçmişe dönük kayıtlarda süresi geçtiyse hiç kurmaz);
 * verilmezse kayıt anından itibaren sayar.
 */
export async function schedulePostMealReminder(minutes = 120, mealLabelText?: string, mealTime?: number): Promise<string | undefined> {
  const N = load();
  if (!N || !(await ensurePermission(N))) return undefined;
  await N.cancelScheduledNotificationAsync(POST_MEAL_ID).catch(() => {});
  const fireAt = mealTime !== undefined ? mealTime + minutes * 60000 : undefined;
  if (fireAt !== undefined && fireAt <= Date.now()) return undefined;
  return N.scheduleNotificationAsync({
    identifier: POST_MEAL_ID,
    content: {
      title: 'Tokluk şekeri vakti geldi!',
      body: `${mealLabelText ? `${mealLabelText} sonrası ` : ''}2 saat doldu. İnsülin ve tabağın dengesini görmek için şekerini ölçelim!`,
    },
    trigger:
      fireAt !== undefined
        ? { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt), channelId: 'hatirlatici' }
        : {
            type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: minutes * 60,
            channelId: 'hatirlatici',
          },
  });
}

const BASAL_ID = 'bazal-hatirlatici';

/** Telefonda GERÇEKTEN kurulu olan bazal hatırlatıcısının saati (ayardaki saatle karşılaştırmak için); yoksa undefined */
export async function scheduledBasal(): Promise<{ hour: number; minute: number } | undefined> {
  const N = load();
  if (!N) return undefined;
  const all = await N.getAllScheduledNotificationsAsync();
  const t = all.find((n) => n.identifier === BASAL_ID)?.trigger as { hour?: number; minute?: number; dateComponents?: { hour?: number; minute?: number } } | null | undefined;
  const hour = t?.hour ?? t?.dateComponents?.hour;
  const minute = t?.minute ?? t?.dateComponents?.minute;
  return typeof hour === 'number' && typeof minute === 'number' ? { hour, minute } : undefined;
}

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
