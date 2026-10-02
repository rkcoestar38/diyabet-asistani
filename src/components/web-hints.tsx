import { View } from 'react-native';

import { Steps } from '@/components/guide';
import { Btn, Card, Row, T } from '@/components/ui';
import { useNow } from '@/lib/hooks';
import { backupNow } from '@/lib/backup';
import { isIos, isStandalone, isWeb } from '@/lib/web';
import { backupDue, useBackup } from '@/store/backup';
import { useLog } from '@/store/log';

/**
 * Web sürümünde: uygulama "Ana Ekrana Ekle" ile açılmadıysa nasıl kuracağını anlatır.
 * Safari sekmesindeki veriler 7 gün kullanılmazsa silinebilir; ana ekran uygulamasında bu sınır yoktur.
 */
export function InstallHint() {
  const hidden = useBackup((s) => s.installHidden);
  const hide = useBackup((s) => s.hideInstall);
  if (!isWeb || hidden || isStandalone()) return null;
  const ios = isIos();
  return (
    <Card title={ios ? 'iPhone’da uygulama gibi kullan' : 'Uygulama gibi yükle'} icon="phone-portrait-outline" tone="soft">
      <T variant="muted">
        {ios
          ? 'Kayıtlarının silinmemesi için bu sayfayı Ana Ekrana ekleyip oradan aç. Safari sekmesinde 7 gün kullanmazsan tarayıcı verileri silebilir; ana ekran uygulamasında bu olmaz.'
          : 'Tarayıcı menüsünden “Uygulamayı yükle” veya “Ana ekrana ekle”yi seç; böylece uygulama gibi açılır ve verilerin daha güvende kalır.'}
      </T>
      {ios ? (
        <Steps items={['Safari’nin alt çubuğundaki Paylaş düğmesine (kare ve yukarı ok) dokun.', '“Ana Ekrana Ekle”yi seç ve Ekle’ye dokun.', 'Bundan sonra uygulamayı ana ekrandaki simgesinden aç.']} />
      ) : null}
      <T variant="small">Önemli: Ana ekran uygulamasının verisi Safari sekmesindekinden ayrıdır. Önce ekleyip sonra kayıt girmeni öneririm; zaten kayıt girdiysen Ayarlar’dan yedek al, ana ekran uygulamasında geri yükle.</T>
      <Row>
        <Btn small variant="ghost" title="Anladım, gizle" onPress={hide} />
      </Row>
    </Card>
  );
}

/** Kayıtlar birikmiş ve son yedek eski/yoksa yedek alma hatırlatması (tüm platformlarda) */
export function BackupReminder() {
  const now = useNow(3600000);
  const count = useLog((s) => s.entries.length);
  const lastAt = useBackup((s) => s.lastAt);
  const snoozedUntil = useBackup((s) => s.snoozedUntil);
  const snooze = useBackup((s) => s.snooze);
  if (!backupDue(count, lastAt, snoozedUntil, now)) return null;
  const days = lastAt === undefined ? undefined : Math.floor((now - lastAt) / 86400000);
  return (
    <Card title="Verilerini yedekle" icon="cloud-upload-outline" tone="soft">
      <View style={{ gap: 4 }}>
        <T variant="muted">
          {days === undefined ? 'Henüz hiç yedek almadın.' : `Son yedeğin ${days} gün önce.`}{' '}
          {isWeb
            ? 'Tarayıcı verisi bazen silinebilir; yedek dosyasını Dosyalar veya iCloud’a kaydet.'
            : 'Telefon değişirse veya uygulama silinirse kayıtların gider; yedek dosyasını güvenli bir yere kaydet.'}
        </T>
      </View>
      <Row>
        <Btn small variant="ghost" title="Sonra" onPress={() => snooze(3)} />
        <Btn small icon="download-outline" title="Şimdi yedekle" style={{ flexGrow: 1 }} onPress={backupNow} />
      </Row>
    </Card>
  );
}
