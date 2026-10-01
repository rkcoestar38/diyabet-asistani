import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Choice, Collapsible, Steps } from '@/components/guide';
import { LabelCalculator } from '@/components/label-calc';
import { EstimateForm, RatioEditor, useApplyEstimate } from '@/components/settings-forms';
import { Btn, Card, KV, Notice, Screen, Segmented, T, confirm, notify } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { useNow } from '@/lib/hooks';
import { fmt } from '@/logic/bolus';
import { MAX_CHANGE, MIN_SAMPLES, analyzeIcr, analyzeIsf, averageTdd, estimateFromTdd, type Suggestion } from '@/logic/ratios';
import { blockEnd, sortBlocks } from '@/logic/schedule';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { useTests } from '@/store/tests';

type Tab = 'find' | 'carbs' | 'mine';

export default function Learn() {
  const [tab, setTab] = useState<Tab>('find');
  return (
    <Screen>
      <Segmented<Tab>
        options={[
          { value: 'find', label: 'Oranlarımı bul' },
          { value: 'carbs', label: 'KH saymayı öğren' },
          { value: 'mine', label: 'Oranlarım' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'find' ? <Find /> : null}
      {tab === 'carbs' ? <CarbGuide /> : null}
      {tab === 'mine' ? <Mine /> : null}
    </Screen>
  );
}

function Find() {
  const settings = useSettings((s) => s.settings);
  const entries = useLog((s) => s.entries);
  const active = useTests((s) => s.active);
  const profile = { dia: settings.dia, peak: settings.peak };
  const icr = analyzeIcr(entries, settings.blocks, profile);
  const isf = analyzeIsf(entries, settings.blocks, profile);
  const blocks = sortBlocks(settings.blocks);

  return (
    <>
      <Card title="Oranlarını adım adım bul" icon="compass">
        <T>
          Oranlarını bilmiyorsan veya emin değilsen, kısa testlerle kendi vücudunun gerçek oranlarını bulabilirsin. Her test sırasında uygulama seni
          yönlendirir.
        </T>
        <Steps
          items={[
            'Başlangıç değerini hesapla (aşağıda).',
            'Bu değerlerle birkaç gün normal yaşa, her yemekte dozunu kaydet.',
            'Testleri yap: birkaç farklı gün/öğünde karbonhidrat oranı, birkaç kez düzeltme testi.',
            `Her saat dilimi için ${MIN_SAMPLES} uygun test birikince uygulama bir değişiklik önerir; sen onaylarsan uygular.`,
          ]}
        />
      </Card>

      {active ? (
        <Choice icon="flask" title="Devam eden testin var" text="Durumu görmek ve ölçüm girmek için dokun." onPress={() => router.push('/test')} />
      ) : (
        <View style={{ gap: Space.sm }}>
          <Choice icon="nutrition" title="Karbonhidrat oranı testi" text="1 Ü kaç gram karşılıyor?" onPress={() => router.push({ pathname: '/test', params: { kind: 'icr' } })} />
          <Choice icon="trending-down" title="Düzeltme faktörü testi" text="1 Ü şekerimi kaç mg/dL düşürüyor?" onPress={() => router.push({ pathname: '/test', params: { kind: 'isf' } })} />
          <Choice icon="moon" title="Bazal insülin testi" text="Yemeksiz şekerim sabit kalıyor mu?" onPress={() => router.push({ pathname: '/test', params: { kind: 'basal' } })} />
        </View>
      )}
      <Notice level="info" text="Normal günlük kayıtların da test sayılabilir: uygun öğünler (yağsız, doğru sayılmış, sonrasında 3 saat bir şey yenmemiş) otomatik değerlendirilir." />

      <Collapsible title="Başlangıç değerini hesapla" icon="calculator" initiallyOpen={settings.ratioSource === 'estimate'}>
        <T variant="muted">Günlük insülin dozlarından kaba bir başlangıç oranı çıkarır.</T>
        <StartEstimate />
      </Collapsible>

      <T variant="h2">Öneriler</T>
      {blocks.map((b) => (
        <Card key={b.id} title={settings.blocks.length > 1 ? `${b.name} · ${b.start}–${blockEnd(settings.blocks, b)}` : 'Tüm gün'} icon="time-outline">
          <SuggestionView kind="icr" s={icr.find((x) => x.blockId === b.id)!} blockId={b.id} />
          <SuggestionView kind="isf" s={isf.find((x) => x.blockId === b.id)!} blockId={b.id} />
        </Card>
      ))}
    </>
  );
}

function StartEstimate() {
  const apply = useApplyEstimate();
  return (
    <EstimateForm
      applyLabel="Oranlarıma uygula"
      onApply={(icr, isf) =>
        confirm(
          'Başlangıç değerlerini uygula',
          `Karbonhidrat oranı 1 Ü = ${icr} g, düzeltme 1 Ü = ${isf} mg/dL olarak ayarlanacak.`,
          () => {
            apply(icr, isf);
            notify('Güncellendi', 'Oranların ayarlandı. İlk günlerde sık ölç.');
          },
          'Uygula',
        )
      }
    />
  );
}

function SuggestionView({ kind, s, blockId }: { kind: 'icr' | 'isf'; s: Suggestion; blockId: string }) {
  const c = useTheme();
  const updateBlock = useSettings((st) => st.updateBlock);
  const update = useSettings((st) => st.update);
  const title = kind === 'icr' ? 'Karbonhidrat oranı' : 'Düzeltme faktörü';
  const unit = kind === 'icr' ? 'g/Ü' : 'mg/dL/Ü';
  const diff = s.suggested !== undefined ? s.suggested - s.current : 0;
  const changed = s.suggested !== undefined && Math.abs(diff) >= (kind === 'icr' ? 0.5 : 1);
  const meaning = diff < 0 ? 'Daha fazla insülin gerekiyor gibi görünüyor.' : 'Daha az insülin gerekiyor gibi görünüyor.';

  return (
    <View style={[styles.sugg, { backgroundColor: c.bg }]}>
      <T variant="h2">{title}</T>
      <KV k="Şu anki" v={`${fmt(s.current)} ${unit}`} />
      <KV k="Uygun test/kayıt" v={`${s.samples.length} / ${MIN_SAMPLES}`} />
      {s.observed !== undefined ? <KV k="Kayıtlara göre gerçekleşen (ortanca)" v={`${fmt(s.observed)} ${unit}`} /> : null}
      {s.suggested === undefined ? (
        <T variant="small">Henüz yeterli veri yok. Yukarıdaki testlerden birini yap.</T>
      ) : changed ? (
        <>
          <KV k={`Öneri (en fazla %${MAX_CHANGE * 100} değişim)`} v={`${fmt(s.suggested)} ${unit}`} strong />
          <Notice level="warn" text={`${meaning}`} />
          <Btn
            small
            variant="secondary"
            title="Ayarlara uygula"
            onPress={() =>
              confirm(
                'Öneriyi uygula',
                `${title} ${fmt(s.current)} → ${fmt(s.suggested!)} ${unit} olarak değişecek.`,
                () => {
                  updateBlock(blockId, { [kind]: s.suggested }, `Test/kayıt analizi (${s.samples.length} kayıt)`);
                  update({ ratioSource: 'doctor' });
                  notify('Güncellendi', 'Yeni oran kaydedildi. Önümüzdeki günlerde sık ölç.');
                },
                'Uygula',
              )
            }
          />
        </>
      ) : (
        <Notice level="info" text="Kayıtların bu oranın iyi çalıştığını gösteriyor." />
      )}
    </View>
  );
}

function CarbGuide() {
  return (
    <>
      <Card title="Karbonhidrat nedir?" icon="nutrition">
        <T>
          Şekerini yükselten besin öğesi karbonhidrattır: ekmek, pirinç, makarna, patates, meyve, süt, şekerli içecekler, tatlılar. Et, tavuk, balık,
          yumurta ve çoğu sebze şekerini az etkiler.
        </T>
      </Card>
      <Card title="Gramı nasıl bulurum?" icon="scale">
        <Steps
          items={[
            'Paketli ürün: etiketteki "Karbonhidrat" satırına bak.',
            'Mümkünse yiyeceği mutfak terazisiyle tart.',
            'Paketli değilse Yemekler sekmesindeki listeden seç; porsiyon veya gram gir.',
            'Toplam karbonhidratı Hesapla ekranına yaz.',
          ]}
        />
        <Notice level="info" text="Etikette “şekerler” değil, toplam “karbonhidrat” değerini kullan." />
      </Card>
      <Card title="Etiketten hesapla" icon="barcode-outline">
        <LabelCalculator />
      </Card>
      <Card title="Doğru saymak için ipuçları" icon="bulb">
        <T>• Pişmiş ve çiğ ağırlık farklıdır: pirinç/makarna pişince su çeker, ağırlığı artar. Listedeki değerler pişmiş içindir.</T>
        <T>• Sıvı yağlar ve et karbonhidrat içermez ama şekerin yükselişini geciktirir.</T>
        <T>• İlk haftalarda tartarak say; zamanla gözle tahmin edebilirsin.</T>
        <T>• Emin değilsen biraz düşük sayıp 2 saat sonra ölçmek, fazla sayıp hipo yaşamaktan güvenlidir.</T>
      </Card>
    </>
  );
}

function Mine() {
  const now = useNow(60000);
  const entries = useLog((s) => s.entries);
  const history = useSettings((s) => s.ratioHistory);
  const avg = averageTdd(entries, now, 7);
  const est = avg ? estimateFromTdd(avg.tdd) : undefined;
  return (
    <>
      <Card title="Oranlarım" icon="options">
        <T variant="muted">Oranların değiştiyse buradan güncelle.</T>
      </Card>
      <RatioEditor />
      {avg && est ? (
        <Card title="Kayıtlarına göre kontrol" icon="journal-outline">
          <KV k={`Ortalama günlük toplam (${avg.days} tam gün)`} v={`${fmt(avg.tdd)} Ü`} />
          <KV k="500 kuralı KH oranı" v={`1 Ü = ${est.icr} g`} />
          <KV k="1800 kuralı düzeltme" v={`1 Ü ≈ ${est.isf} mg/dL`} />
          <KV k="Önerilen bazal aralığı" v={`${fmt(est.basalLow)}–${fmt(est.basalHigh)} Ü`} />
          <T variant="small">Yalnızca hem bazal hem hızlı insülin kaydı olan tamamlanmış günler (bugün hariç) hesaba katılır.</T>
        </Card>
      ) : null}
      {history.length > 0 ? (
        <Card title="Değişiklik geçmişi" icon="git-commit-outline">
          {history.slice(0, 30).map((h) => (
            <View key={`${h.time}-${h.blockName}-${h.field}`}>
              <T>
                {h.blockName} · {h.field === 'icr' ? 'KH oranı' : 'Düzeltme'}: {fmt(h.from)} → {fmt(h.to)}
              </T>
              <T variant="small">
                {new Date(h.time).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })} · {h.source}
              </T>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  sugg: { borderRadius: Radius.md, padding: Space.md, gap: Space.xs },
});
