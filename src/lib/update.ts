import Constants from 'expo-constants';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { storage } from '@/store/storage';

/** Güncellemelerin yayınlandığı GitHub deposu (herkese açık; Release ekindeki APK indirilir) */
export const UPDATE_REPO = 'rkcoestar38/diyabet-asistani';

export type UpdateInfo = {
  version: string;
  apkUrl?: string;
  pageUrl: string;
  notes: string;
};

/** "v1.2.3" / "1.2.3" → [1,2,3] */
export function parseVersion(v: string): number[] {
  return v
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((p) => Number.parseInt(p, 10))
    .map((n) => (Number.isFinite(n) ? n : 0));
}

/** a > b ise 1, a < b ise -1, eşitse 0 */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a);
  const y = parseVersion(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export const currentVersion = (): string =>
  Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '1.0.7';

type Release = { tag_name?: string; html_url?: string; body?: string; draft?: boolean; prerelease?: boolean; assets?: { name: string; browser_download_url: string }[] };

/** En son yayını okur; yeni sürüm yoksa null. Ağ hatasında fırlatır. */
export async function fetchLatest(current = currentVersion()): Promise<{ latest: UpdateInfo; isNewer: boolean }> {
  const res = await fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
  if (res.status === 404) throw new Error('Henüz yayınlanmış bir sürüm yok.');
  if (!res.ok) throw new Error(`GitHub yanıtı: ${res.status}`);
  const r = (await res.json()) as Release;
  const tag = r.tag_name ?? '';
  if (!tag) throw new Error('Sürüm bilgisi okunamadı.');
  const apk = r.assets?.find((a) => a.name.toLowerCase().endsWith('.apk'));
  const latest: UpdateInfo = {
    version: tag.replace(/^v/i, ''),
    apkUrl: apk?.browser_download_url,
    pageUrl: r.html_url ?? `https://github.com/${UPDATE_REPO}/releases/latest`,
    // GitHub'ın otomatik eklediği "Full Changelog" bağlantısı kullanıcıya anlamlı değil
    notes: (r.body ?? '').split(/\r?\n/).filter((l) => !/full changelog/i.test(l)).join('\n').trim(),
  };
  return { latest, isNewer: compareVersions(latest.version, current) > 0 };
}

type State = {
  /** Son otomatik denetim zamanı */
  lastCheck: number;
  /** "Sonra" denilen sürüm */
  dismissed?: string;
  /** Bulunan yeni sürüm (oturum boyunca) */
  available?: UpdateInfo;
  set: (p: Partial<Pick<State, 'lastCheck' | 'dismissed' | 'available'>>) => void;
};

export const useUpdateStore = create<State>()(
  persist((set) => ({ lastCheck: 0, set: (p) => set(p) }), {
    name: 'update',
    storage,
    version: 1,
    partialize: (s) => ({ lastCheck: s.lastCheck, dismissed: s.dismissed, available: s.available }),
  }),
);

const THIRTY_MINUTES = 30 * 60000;

/** Açılışta (en fazla 30 dakikada bir) sessizce yeni sürüm arar. Hata olursa sessizce geçer. */
export async function autoCheck(now = Date.now(), force = false) {
  const st = useUpdateStore.getState();
  const cur = currentVersion();

  // Hafızadaki sürüm zaten kurulu sürüme eşit veya daha eskiyse temizle
  if (st.available && compareVersions(st.available.version, cur) <= 0) {
    st.set({ available: undefined });
  }

  if (!force && now - st.lastCheck < THIRTY_MINUTES) return;
  try {
    const { latest, isNewer } = await fetchLatest(cur);
    st.set({ lastCheck: now, available: isNewer ? latest : undefined });
  } catch {
    // çevrimdışı olabilir; bir dahaki açılışta tekrar denenir
  }
}
