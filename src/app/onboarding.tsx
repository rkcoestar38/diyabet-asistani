import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Choice, Steps, StepDots } from '@/components/guide';
import { WaterLevel } from '@/components/water';
import { EstimateForm, InsulinForm, RatioEditor, useApplyEstimate } from '@/components/settings-forms';
import { Btn, Card, Field, Row, Screen, T } from '@/components/ui';
import { Space } from '@/constants/theme';
import { applyMockData } from '@/data/seed-mock';
import { fmt } from '@/logic/bolus';
import { scheduleProblems } from '@/logic/schedule';
import { useSettings } from '@/store/settings';

type Path = 'doctor' | 'estimate';
const TOTAL = 5;

export default function Onboarding() {
  const s = useSettings((st) => st.settings);
  const update = useSettings((st) => st.update);
  const applyEstimate = useApplyEstimate();
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<Path | null>(null);
  const [estimated, setEstimated] = useState(false);
  const [basalName, setBasalName] = useState(s.basalName);
  const valid = scheduleProblems(s.blocks).length === 0;

  const handleApplyMock = () => {
    applyMockData();
    router.replace('/');
  };

  const nav = (canNext: boolean, next = () => setStep(step + 1)) => (
    <Row>
      {step > 0 ? <Btn variant="ghost" icon="arrow-back" title="Geri" onPress={() => setStep(step - 1)} /> : null}
      <Btn title="İleri" icon="arrow-forward" disabled={!canNext} onPress={next} style={{ flexGrow: 1 }} />
    </Row>
  );

  return (
    <Screen>
      <StepDots step={step} total={TOTAL} />

      {step === 0 ? (
        <WaterLevel level={0.62} height={170}>
          <T variant="label" color="primary" style={{ marginBottom: 0 }}>
            Hoş geldin
          </T>
          <View style={{ gap: 4 }}>
            <T variant="title">Şekerini sakin tut.</T>
            <T variant="muted" color="text">
              Karbonhidratı say, dozu hesapla, oranlarını öğren.
            </T>
          </View>
        </WaterLevel>
      ) : null}

      {step === 0 ? (
        <Card title="Nasıl çalışır?" icon="sparkles-outline">
          <T>
            Bu uygulama yemeklerindeki karbonhidratı saymana ve kaç ünite insülin vuracağını hesaplamana yardım eder. Oranlarını henüz
            bilmiyorsan, onları adım adım bulmanı da sağlar.
          </T>
          {nav(true)}
          {__DEV__ ? (
            <Btn
              variant="secondary"
              icon="sparkles"
              title="Demo Verileriyle Başla (HbA1c %6.6)"
              onPress={handleApplyMock}
            />
          ) : null}
        </Card>
      ) : null}

      {step === 1 ? (
        <>
          <Card title="Hangi insülinleri kullanıyorsun?" icon="medkit">
            <T variant="muted">Emin değilsen kalemin üzerindeki ismi kontrol et.</T>
          </Card>
          <InsulinForm advanced={false} />
          <Card title="Uzun etkili (bazal) insülinim" icon="moon">
            <Row>
              <Field
                label="Adı (isteğe bağlı)"
                keyboard="text"
                placeholder="ör. Tresiba, Lantus"
                value={basalName}
                onChangeText={(v) => {
                  setBasalName(v);
                  update({ basalName: v });
                }}
              />
            </Row>
          </Card>
          {nav(true)}
          {__DEV__ ? (
            <Btn
              variant="secondary"
              icon="sparkles"
              title="Demo Verilerini Yükle (HbA1c %6.6)"
              onPress={handleApplyMock}
            />
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Card title="Karbonhidrat oranını biliyor musun?" icon="help-buoy">
            <T variant="muted">
              Karbonhidrat oranı, 1 ünite insülinin kaç gram karbonhidratı karşıladığıdır (ör. “1 ünite = 10 gram”). Doktorun veya diyabet
              hemşiren sana bunu söylemiş olabilir.
            </T>
          </Card>
          <Choice
            icon="document-text"
            title="Evet, biliyorum"
            text="Doktorumun verdiği değerleri gireceğim."
            selected={path === 'doctor'}
            onPress={() => {
              setPath('doctor');
              update({ ratioSource: 'doctor' });
              setStep(3);
            }}
          />
          <Choice
            icon="compass"
            title="Hayır, birlikte bulalım"
            text="Günlük insülin dozlarımdan başlangıç değeri çıkar, sonra testlerle gerçeğini bulayım."
            selected={path === 'estimate'}
            onPress={() => {
              setPath('estimate');
              setStep(3);
            }}
          />
          <Btn variant="ghost" icon="arrow-back" title="Geri" onPress={() => setStep(1)} />
        </>
      ) : null}

      {step === 3 && path === 'doctor' ? (
        <>
          <Card title="Oranlarını gir" icon="create">
            <T variant="muted">Bir terimin ne demek olduğunu görmek için yanındaki ? işaretine dokun.</T>
          </Card>
          <RatioEditor source="İlk kurulum" />
          <Card>
            {nav(valid)}
          </Card>
        </>
      ) : null}

      {step === 3 && path === 'estimate' ? (
        <>
          <Card title="Başlangıç değerini bulalım" icon="calculator">
            <T>
              Şu an kullandığın insülin dozlarından, dünyada yaygın kullanılan iki kuralla (500 ve 1800 kuralları) bir başlangıç oranı
              hesaplayacağız. Bu sadece bir başlangıç: uygulamanın rehberli testleriyle gerçek oranını bulacaksın.
            </T>
            <EstimateForm
              onApply={(icr, isf) => {
                applyEstimate(icr, isf);
                setEstimated(true);
                setStep(4);
              }}
            />
          </Card>
          <Btn variant="ghost" icon="arrow-back" title="Geri" onPress={() => setStep(2)} />
        </>
      ) : null}

      {step === 4 ? (
        <>
          <WaterLevel level={0.9} height={120}>
            <T variant="title">Hazırsın.</T>
            <T variant="muted">Oranların kaydedildi.</T>
          </WaterLevel>
          <Card title="Şu anki ayarların" icon="checkmark-circle">
            <View style={{ gap: Space.xs }}>
              {s.blocks.map((b) => (
                <T key={b.id}>
                  • {b.name}: <T style={{ fontWeight: '700' }}>1 Ü = {fmt(b.icr)} g</T> · 1 Ü ↓ {b.isf} · hedef {b.target}
                </T>
              ))}
              <T variant="small">Ara öğünler ve gece, kendinden önceki ana öğünün oranını kullanır.</T>
            </View>
          </Card>
          <Card title="Nasıl kullanılır?" icon="bulb">
            <Steps
              items={[
                'Yemekten önce şekerini ölç ve Hesapla ekranına yaz.',
                'Yiyeceğin karbonhidratı gir ya da Yemekler’den seç.',
                'Önerilen dozu kontrol et, vurduğun dozu kaydet.',
                ...(estimated || s.ratioSource === 'estimate'
                  ? ['Öğren sekmesindeki rehberli testlerle gerçek oranlarını bul. İlk günlerde sık ölç.']
                  : ['Öğren sekmesinde oranlarının tutup tutmadığını takip edebilirsin.']),
              ]}
            />
          </Card>
          <Row>
            <Btn variant="ghost" icon="arrow-back" title="Geri" onPress={() => setStep(3)} />
            <Btn
              title="Başla"
              icon="rocket"
              disabled={!valid}
              style={{ flexGrow: 1 }}
              onPress={() => {
                update({ onboarded: true });
                router.replace('/');
              }}
            />
          </Row>
        </>
      ) : null}
    </Screen>
  );
}
