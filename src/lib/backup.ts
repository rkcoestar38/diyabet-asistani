import { notify } from '@/components/ui';
import { useBackup } from '@/store/backup';
import { useFoods } from '@/store/foods';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';

import { shareText } from './files';

const BACKUP_VERSION = 1;

/** Tüm verilerin JSON yedeği (ayarlar, günlük, kendi yemekler, oran geçmişi) */
export function buildBackup() {
  return {
    app: 'diyabet-asistani',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: useSettings.getState().settings,
    ratioHistory: useSettings.getState().ratioHistory,
    log: useLog.getState().entries,
    foods: {
      customFoods: useFoods.getState().customFoods,
      favorites: useFoods.getState().favorites,
      meals: useFoods.getState().meals,
    },
  };
}

/** Yedeği paylaşım menüsünden (veya tarayıcıda indirme olarak) kaydeder; başarılıysa hatırlatmayı sıfırlar. */
export async function backupNow(): Promise<boolean> {
  const data = buildBackup();
  try {
    await shareText(`diyabet-yedek-${data.exportedAt.slice(0, 10)}.json`, JSON.stringify(data, null, 1), 'application/json');
    useBackup.getState().markDone();
    return true;
  } catch (e) {
    // Kullanıcı paylaşım menüsünü kapattıysa (AbortError) hata sayılmaz
    if (e instanceof Error && e.name === 'AbortError') return false;
    notify('Yedek alınamadı', String(e));
    return false;
  }
}
