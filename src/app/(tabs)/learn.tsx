import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Choice, Collapsible, Steps } from '@/components/guide';
import { LabelCalculator } from '@/components/label-calc';
import { RatioTrend, SuggestionView } from '@/components/ratio-trend';
import { EstimateForm, RatioEditor, useApplyEstimate } from '@/components/settings-forms';
import { Card, KV, Notice, Screen, T, confirm, notify } from '@/components/ui';
import { Space } from '@/constants/theme';
import { useNow } from '@/lib/hooks';
import { fmt } from '@/logic/bolus';
import { MIN_SAMPLES, analyzeIcr, analyzeIsf, averageTdd, estimateFromTdd } from '@/logic/ratios';
import { blockEnd, sortBlocks } from '@/logic/schedule';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { useTests } from '@/store/tests';

export default function Learn() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [openFind, setOpenFind] = useState(params.tab === 'find');
  const [openCarbs, setOpenCarbs] = useState(params.tab === 'carbs');
  const [openMine, setOpenMine] = useState(params.tab === 'mine');

  const [seenTab, setSeenTab] = useState(params.tab);
  if (params.tab !== seenTab) {
    setSeenTab(params.tab);
    if (params.tab === 'find') setOpenFind(true);
    if (params.tab === 'carbs') setOpenCarbs(true);
    if (params.tab === 'mine') setOpenMine(true);
  }

  return (
    <Screen>
      <SuggestionsSection />

      <Collapsible title="Oranlarımı bul" icon="compass" open={openFind} onToggle={setOpenFind}>
        <Find />
      </Collapsible>

      <Collapsible title="KH saymayı öğren" icon="nutrition" open={openCarbs} onToggle={setOpenCarbs}>
        <CarbGuide />
      </Collapsible>

      <Collapsible title="Oranlarım" icon="options" open={openMine} onToggle={setOpenMine}>
        <Mine />
      </Collapsible>
    </Screen>
  );
}

function SuggestionsSection() {
  const settings = useSettings((s) => s.settings);
  const entries = useLog((s) => s.entries);
  const profile = { dia: settings.dia, peak: settings.peak };
  const icr = analyzeIcr(entries, settings.blocks, profile);
  const isf = analyzeIsf(entries, settings.blocks, profile);
  const blocks = sortBlocks(settings.blocks);

  return (
    <Card title="Öneriler" icon="bulb-outline">
      <T variant="muted">Kayıtlarına ve testlerine göre hesaplanan oran önerileri:</T>
      {blocks.map((b) => (
        <View key={b.id} style={{ gap: Space.sm, marginTop: Space.xs }}>
          {settings.blocks.length > 1 ? (
            <T style={{ fontWeight: '700' }}>{`${b.name} (${b.start}–${blockEnd(settings.blocks, b)})`}</T>
          ) : null}
          <SuggestionView kind="icr" s={icr.find((x) => x.blockId === b.id)!} blockId={b.id} />
          <SuggestionView kind="isf" s={isf.find((x) => x.blockId === b.id)!} blockId={b.id} />
        </View>
      ))}
    </Card>
  );
}

function Find() {
  const settings = useSettings((s) => s.settings);
  const active = useTests((s) => s.active);

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
      <RatioTrend />
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
