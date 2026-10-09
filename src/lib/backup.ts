import { notify } from '@/components/ui';
import { useBackup } from '@/store/backup';
import { useFoods } from '@/store/foods';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { useTests } from '@/store/tests';

import { shareText } from './files';

const BACKUP_VERSION = 2;

/** Yerel tarihle yyyy-mm-dd üretir (toISOString UTC olduğu için doğrudan kullanılmaz) */
function localDay(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Tüm verilerin JSON yedeği (ayarlar, günlük, kendi yemekler, oran geçmişi, oran testleri) */
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
    tests: {
      active: useTests.getState().active,
      finished: useTests.getState().finished,
    },
  };
}

/** Yedeği paylaşım menüsünden (veya tarayıcıda indirme olarak) kaydeder; başarılıysa hatırlatmayı sıfırlar. */
export async function backupNow(): Promise<boolean> {
  const data = buildBackup();
  try {
    await shareText(`diyabet-yedek-${localDay(Date.now())}.json`, JSON.stringify(data, null, 1), 'application/json');
    useBackup.getState().markDone();
    return true;
  } catch (e) {
    // Kullanıcı paylaşım menüsünü kapattıysa (AbortError) hata sayılmaz
    if (e instanceof Error && e.name === 'AbortError') return false;
    notify('Yedek alınamadı', String(e));
    return false;
  }
}
