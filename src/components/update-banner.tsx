import { useEffect } from 'react';
import { Linking } from 'react-native';

import { Btn, Card, Row, T } from '@/components/ui';
import { autoCheck, currentVersion, useUpdateStore } from '@/lib/update';

/** Yeni sürüm bulunduysa Hesapla ekranının üstünde görünür; açılışta (6 saatte bir) arka planda kontrol edilir. */
export function UpdateBanner() {
  const available = useUpdateStore((s) => s.available);
  const dismissed = useUpdateStore((s) => s.dismissed);
  const set = useUpdateStore((s) => s.set);

  useEffect(() => {
    autoCheck();
  }, []);

  if (!available || dismissed === available.version) return null;
  return (
    <Card title={`Yeni sürüm var: ${available.version}`} icon="cloud-download-outline" tone="soft">
      <T variant="muted">Şu an {currentVersion()} sürümünü kullanıyorsun. Verilerin güncellemeden etkilenmez.</T>
      {available.notes ? (
        <T variant="small" numberOfLines={4}>
          {available.notes}
        </T>
      ) : null}
      <Row>
        <Btn small variant="ghost" title="Sonra" onPress={() => set({ dismissed: available.version })} />
        <Btn
          small
          icon="download-outline"
          title="İndir ve kur"
          style={{ flexGrow: 1 }}
          onPress={() => Linking.openURL(available.apkUrl ?? available.pageUrl)}
        />
      </Row>
      <T variant="small">İndirme bitince bildirimden dosyaya dokun; Android “Kur”u onaylamanı ister.</T>
    </Card>
  );
}
