import { useState } from 'react';
import { View } from 'react-native';

import { Help, type GlossaryKey } from '@/components/guide';
import { Btn, Card, Field, Notice, Row, Segmented, T, TimeField, Toggle, confirm, parseNum, useInRow } from '@/components/ui';
import { parseTimeInput } from '@/lib/input';
import { Space, useTheme } from '@/constants/theme';
import { fmt } from '@/logic/bolus';
import { estimateFromTdd } from '@/logic/ratios';
import { LIMITS, activeBlock, blockEnd, inLimit, scheduleProblems, sortBlocks } from '@/logic/schedule';
import type { TimeBlock } from '@/logic/types';
import { isSingleBlock, useSettings } from '@/store/settings';

/**
 * Sayı alanı. Yalnızca `min`–`max` aralığındaki değerler kaydedilir; yazarken oluşan
 * ara değerler (ör. "10" yerine bir anlığına "1") kaydedilmez, alan altında uyarı görünür.
 */
export function NumField({
  label,
  help,
  value,
  onCommit,
  suffix,
  min,
  max,
  step,
}: {
  label: string;
  help?: GlossaryKey;
  value: number;
  onCommit: (n: number) => void;
  suffix?: string;
  min: number;
  max: number;
  /** −/+ düğme adımı */
  step?: number;
}) {
  const c = useTheme();
  const inRow = useInRow();
  const show = (n: number) => String(n).replace('.', ',');
  const [text, setText] = useState(show(value));
  // Değer dışarıdan değiştiyse (ör. öneri uygulandı) alanı güncelle
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    if (parseNum(text) !== value) setText(show(value));
  }
  const n = parseNum(text);
  const invalid = text.trim() !== '' && !(n !== undefined && n >= min && n <= max);
  return (
    <View style={inRow ? { flexGrow: 1, flexBasis: 0, minWidth: 130 } : undefined}>
      {help ? <Help term={help} label={label} /> : null}
      <Field
        label={help ? undefined : label}
        // Satır boyutlandırmasını dıştaki View yapar; içteki alan dikeyde doğal yüksekliğinde kalmalı
        style={{ flexGrow: 0, flexBasis: 'auto', minWidth: 0 }}
        value={text}
        suffix={suffix}
        step={step}
        min={min}
        max={max}
        base={value}
        onChangeText={(s) => {
          setText(s);
          const v = parseNum(s);
          if (v !== undefined && v >= min && v <= max) onCommit(v);
        }}
      />
      {invalid ? (
        <T variant="small" style={{ color: c.danger }}>
          {min}–{max} arası olmalı; kaydedilmedi
        </T>
      ) : null}
    </View>
  );
}

/** Bir dilimin oran alanları */
function RatioFields({ block, source }: { block: TimeBlock; source: string }) {
  const updateBlock = useSettings((s) => s.updateBlock);
  const up = (patch: Partial<TimeBlock>) => updateBlock(block.id, patch, source);
  return (
    <>
      <Row>
        <NumField label="KH oranı: 1 Ü =" help="icr" suffix="g" step={1} value={block.icr} min={LIMITS.icr.min} max={LIMITS.icr.max} onCommit={(icr) => up({ icr })} />
        <NumField label="Düzeltme: 1 Ü düşürür" help="isf" suffix="mg/dL" step={5} value={block.isf} min={LIMITS.isf.min} max={LIMITS.isf.max} onCommit={(isf) => up({ isf })} />
      </Row>
      <Row>
        <NumField label="Hedef" help="target" suffix="mg/dL" step={5} value={block.target} min={LIMITS.target.min} max={LIMITS.target.max} onCommit={(target) => up({ target })} />
        <NumField label="Aralık alt" step={5} value={block.low} min={LIMITS.low.min} max={LIMITS.low.max} onCommit={(low) => up({ low })} />
        <NumField label="Aralık üst" step={5} value={block.high} min={LIMITS.high.min} max={LIMITS.high.max} onCommit={(high) => up({ high })} />
      </Row>
    </>
  );
}

function BlockCard({ block, blocks, source }: { block: TimeBlock; blocks: TimeBlock[]; source: string }) {
  const updateBlock = useSettings((s) => s.updateBlock);
  const removeBlock = useSettings((s) => s.removeBlock);
  const [name, setName] = useState(block.name);
  const [start, setStart] = useState(block.start);
  return (
    <Card
      title={`${block.name}  ·  ${block.start}–${blockEnd(blocks, block)}`}
      icon="time-outline"
      right={
        blocks.length > 1 ? (
          <Btn
            small
            variant="ghost"
            icon="trash-outline"
            title="Sil"
            onPress={() => confirm('Dilimi sil', `"${block.name}" silinsin mi?`, () => removeBlock(block.id), 'Sil')}
          />
        ) : null
      }>
      <Row>
        <Field label="Ad" keyboard="text" value={name} onChangeText={(s) => { setName(s); updateBlock(block.id, { name: s }); }} />
        <TimeField
          label="Başlangıç saati"
          value={start}
          onChange={(v) => {
            setStart(v);
            if (parseTimeInput(v) !== undefined) updateBlock(block.id, { start: v });
          }}
        />
      </Row>
      <RatioFields block={block} source={source} />
    </Card>
  );
}

/**
 * Oranlarım: varsayılan olarak tüm gün için tek oran; istenirse saate göre farklı oranlar.
 */
export function RatioEditor({ source = 'Elle düzenleme' }: { source?: string }) {
  const blocks = useSettings((s) => s.settings.blocks);
  const addBlock = useSettings((s) => s.addBlock);
  const setTimeBlocks = useSettings((s) => s.setTimeBlocks);
  const single = isSingleBlock(blocks);
  const problems = scheduleProblems(blocks);

  return (
    <View style={{ gap: Space.md }}>
      {single ? (
        <Card title="Oranlarım (tüm gün)" icon="options-outline">
          <RatioFields block={blocks[0]} source={source} />
        </Card>
      ) : (
        <>
          <T variant="muted">
            Her dilim, başlangıç saatinden bir sonraki dilimin başlangıcına kadar geçerlidir. Son dilim gece yarısını geçip ilk dilime kadar sürer.
          </T>
          {sortBlocks(blocks).map((b) => (
            <BlockCard key={b.id} block={b} blocks={blocks} source={source} />
          ))}
          <Btn variant="secondary" icon="add" title="Saat dilimi ekle" onPress={addBlock} />
        </>
      )}
      {problems.map((p) => (
        <Notice key={p} level="danger" text={p} />
      ))}
      <Toggle
        label="Günün saatine göre farklı oranlar kullanıyorum (ör. sabah daha güçlü)"
        value={!single}
        onChange={(on) => {
          if (on) setTimeBlocks(true);
          else
            confirm(
              'Tek orana geç',
              'Saat dilimleri silinecek; şu an geçerli dilimin oranları tüm güne uygulanacak.',
              () => setTimeBlocks(false, activeBlock(blocks, new Date())),
              'Tek orana geç',
            );
        }}
      />
    </View>
  );
}

const INSULINS = [
  { value: 'standard', label: 'NovoRapid / Humalog / Apidra', peak: 75 },
  { value: 'ultra', label: 'Fiasp / Lyumjev', peak: 55 },
] as const;

export function InsulinForm({ advanced = true }: { advanced?: boolean }) {
  const s = useSettings((st) => st.settings);
  const update = useSettings((st) => st.update);
  const type = s.peak <= 60 ? 'ultra' : 'standard';
  return (
    <Card title="Hızlı etkili insülinim" icon="medkit-outline">
      <Segmented
        options={INSULINS.map((i) => ({ value: i.value, label: i.label }))}
        value={type}
        onChange={(v) => {
          const ins = INSULINS.find((i) => i.value === v)!;
          update({ peak: ins.peak, rapidName: ins.label.split(' / ')[0] });
        }}
      />
      <View>
        <T variant="label">Kalemim kaçar kaçar ayarlanıyor?</T>
        <Segmented
          options={[
            { value: '0.5', label: 'Yarım ünite (0,5)' },
            { value: '1', label: 'Tam ünite (1)' },
          ]}
          value={String(s.penStep)}
          onChange={(v) => update({ penStep: Number(v) })}
        />
      </View>
      {advanced ? (
        <>
          <Row>
            <NumField label="Etki süresi" suffix="saat" step={0.5} value={s.dia} min={3} max={8} onCommit={(dia) => update({ dia })} />
            <NumField label="Azami tek doz" suffix="Ü" step={1} value={s.maxBolus} min={1} max={100} onCommit={(maxBolus) => update({ maxBolus })} />
          </Row>
          <T variant="small">
            Etki süresi aktif insülin hesabında kullanılır; çoğu kişi için 4 saat uygundur. Azami tek doz aşılırsa uygulama kırmızı uyarı verir.
          </T>
          <Toggle
            label="Şekerim hedefin altındaysa yemek dozunu azalt (ters düzeltme)"
            value={s.reverseCorrection}
            onChange={(reverseCorrection) => update({ reverseCorrection })}
          />
        </>
      ) : null}
    </Card>
  );
}

/**
 * Günlük insülin miktarından başlangıç oranı tahmini (500 ve 1800 kuralları).
 * Bazal ve gün içindeki hızlı dozlar ayrı sorulur; toplamı kullanıcı hesaplamak zorunda kalmaz.
 */
export function EstimateForm({ onApply, applyLabel = 'Bu değerleri kullan' }: { onApply: (icr: number, isf: number) => void; applyLabel?: string }) {
  const [basal, setBasal] = useState('');
  const [rapid, setRapid] = useState('');
  const b = parseNum(basal) ?? 0;
  const r = parseNum(rapid) ?? 0;
  const tdd = b + r;
  const est = b > 0 && r > 0 ? estimateFromTdd(tdd) : undefined;
  return (
    <View style={{ gap: Space.md }}>
      <Row>
        <Field label="Günlük bazal (uzun etkili) dozun" suffix="Ü" value={basal} onChangeText={setBasal} placeholder="ör. 20" />
        <Field label="Gün içinde vurduğun hızlı insülin toplamı" suffix="Ü" value={rapid} onChangeText={setRapid} placeholder="ör. 18" />
      </Row>
      <T variant="small">
        Hızlı insülin için tipik bir günü düşün: kahvaltı + öğle + akşam + ara düzeltmeler. Tam bilmiyorsan son 3 günün ortalamasını yaz.
      </T>
      {est ? (
        <>
          <Card style={{ gap: Space.xs }}>
            <T variant="muted">Günlük toplam: {fmt(tdd)} Ü</T>
            <T>
              Karbonhidrat oranı: <T style={{ fontWeight: '700' }}>1 Ü = {est.icr} g</T>{' '}
              <T variant="small">(500 ÷ {fmt(tdd)})</T>
            </T>
            <T>
              Düzeltme faktörü: <T style={{ fontWeight: '700' }}>1 Ü ≈ {est.isf} mg/dL</T>{' '}
              <T variant="small">(1800 ÷ {fmt(tdd)})</T>
            </T>
            {b < tdd * 0.3 || b > tdd * 0.65 ? (
              <Notice
                level="info"
                text={`Bazal dozun günlük toplamın %${Math.round((b / tdd) * 100)}’i. Genellikle %40–50 civarında olur.`}
              />
            ) : null}
          </Card>
          <Notice
            level="warn"
            text="Bu kaba bir başlangıç tahmini (güvenli tarafta yuvarlandı). İlk günlerde sık ölç; Öğren sekmesindeki testlerle gerçek oranlarını bul."
          />
          <Btn icon="checkmark" title={applyLabel} onPress={() => onApply(est.icr, est.isf)} />
        </>
      ) : null}
    </View>
  );
}

/** Tahmini tüm dilimlere uygular */
export function useApplyEstimate() {
  const blocks = useSettings((s) => s.settings.blocks);
  const updateBlock = useSettings((s) => s.updateBlock);
  const update = useSettings((s) => s.update);
  return (icr: number, isf: number) => {
    if (!inLimit('icr', icr) || !inLimit('isf', isf)) return;
    blocks.forEach((b) => updateBlock(b.id, { icr, isf }, 'Başlangıç tahmini (500/1800 kuralı)'));
    update({ ratioSource: 'estimate' });
  };
}
