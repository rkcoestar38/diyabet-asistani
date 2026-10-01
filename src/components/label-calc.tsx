import { useState } from 'react';
import { View } from 'react-native';

import { Btn, Field, Row, Segmented, T, parseNum } from '@/components/ui';
import { Space } from '@/constants/theme';
import { fmt } from '@/logic/bolus';

type Mode = 'per100' | 'serving';

/** Paket etiketinden karbonhidrat: "100 g’da" veya "1 porsiyonda" yazan değerden hesaplar. */
export function LabelCalculator({ onUse, useLabel = 'Bu değeri kullan' }: { onUse?: (carbs: number) => void; useLabel?: string }) {
  const [mode, setMode] = useState<Mode>('per100');
  const [labelValue, setLabelValue] = useState('');
  const [amount, setAmount] = useState('');
  const v = parseNum(labelValue);
  const a = parseNum(amount);
  const carbs = v !== undefined && a !== undefined && v >= 0 && a > 0 ? (mode === 'per100' ? (v * a) / 100 : v * a) : undefined;
  const valid = carbs !== undefined && (mode === 'serving' || (v ?? 0) <= 100);

  return (
    <View style={{ gap: Space.md }}>
      <Segmented<Mode>
        options={[
          { value: 'per100', label: 'Etikette 100 g’da yazıyor' },
          { value: 'serving', label: 'Etikette porsiyonda yazıyor' },
        ]}
        value={mode}
        onChange={setMode}
      />
      <Row>
        <Field
          label={mode === 'per100' ? '100 g’daki karbonhidrat' : '1 porsiyondaki karbonhidrat'}
          suffix="g"
          value={labelValue}
          onChangeText={setLabelValue}
        />
        <Field label={mode === 'per100' ? 'Yediğin miktar' : 'Kaç porsiyon'} suffix={mode === 'per100' ? 'g' : 'adet'} value={amount} onChangeText={setAmount} />
      </Row>
      {valid ? (
        <View style={{ alignItems: 'center', gap: 2 }}>
          <T variant="big" color="primary">
            {fmt(carbs!)} g
          </T>
          <T variant="small">
            {mode === 'per100' ? `${fmt(v!)} × ${fmt(a!)} ÷ 100` : `${fmt(v!)} × ${fmt(a!)}`} = {fmt(carbs!)} g karbonhidrat
          </T>
        </View>
      ) : mode === 'per100' && (v ?? 0) > 100 ? (
        <T variant="small" color="danger">
          100 g’da en fazla 100 g karbonhidrat olabilir; etiketi kontrol et.
        </T>
      ) : (
        <T variant="small">
          {mode === 'per100'
            ? 'İpucu: Etiketteki “Karbonhidrat” satırına bak (“şekerler” değil, toplam karbonhidrat). Yediğin miktarı mutfak terazisiyle tartarsan sonuç en doğru olur.'
            : 'İpucu: Porsiyonun kaç gram olduğu etikette yazar; senin porsiyonun farklıysa “100 g’da” sekmesini kullan.'}
        </T>
      )}
      {onUse && valid ? <Btn icon="checkmark" title={`${useLabel} (${Math.round(carbs!)} g)`} onPress={() => onUse(Math.round(carbs!))} /> : null}
    </View>
  );
}
