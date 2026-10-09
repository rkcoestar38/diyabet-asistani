'use no memo';
import React from 'react';

import { FlexWidget, TextWidget } from 'react-native-android-widget';

/**
 * Android ana ekran widget'ı: son öğünden 2 saat sonrası tokluk şekeri için geri sayım.
 * Tüm widget yalnızca kütüphanenin primitive'lerinden oluşur (hook yok, RN bileşeni yok).
 * Tıklanınca uygulamanın tokluk ölçümü ekranını açar (OPEN_URI).
 */

export type ToklukWidgetProps = {
  /** idle: bekleyen öğün yok · counting: geri sayım · due: 2 saat doldu */
  state: 'idle' | 'counting' | 'due';
  /** Üst başlık: "Akşam · 19:04" gibi */
  title: string;
  /** Büyük sayaç: "38 dk", "+12 dk" veya kısa durum metni */
  big: string;
  /** Alt bilgi satırı */
  sub: string;
  /** 0–1 arası ilerleme oranı */
  progress: number;
  /** Tıklanınca açılacak derin bağlantı */
  uri: string;
};

// Sabit koyu tema: widget görsel olarak render edildiği için sistem açık/koyu modundan bağımsız tek tasarım
const COLORS = {
  bg: '#0F2327',
  text: '#E8F3F3',
  muted: '#8DA3A7',
  accent: '#4CC3CF',
  ok: '#6FD39C',
  track: '#1B3A40',
} as const;

export function ToklukWidget(props: ToklukWidgetProps) {
  const accent = props.state === 'due' ? COLORS.ok : COLORS.accent;
  const filled = Math.max(2, Math.round(props.progress * 98));
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: props.uri }}
      accessibilityLabel="Tokluk şekeri geri sayımı"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: COLORS.bg,
        borderRadius: 22,
        padding: 16,
        justifyContent: 'space-between',
        flexDirection: 'column',
        flexGap: 8,
      }}
    >
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexGap: 6 }}>
        <TextWidget text={props.title} style={{ fontSize: 13, color: COLORS.muted }} />
        <TextWidget text={props.state === 'due' ? 'ÖLÇÜM VAKTİ' : 'TOKLUK'} style={{ fontSize: 10, color: accent }} />
      </FlexWidget>

      <TextWidget text={props.big} style={{ fontSize: 44, fontWeight: '700', color: COLORS.text }} />

      <FlexWidget style={{ height: 6, borderRadius: 3, backgroundColor: COLORS.track, overflow: 'hidden', flexDirection: 'row' }}>
        <FlexWidget style={{ flex: props.state === 'idle' ? 0 : filled, backgroundColor: accent, borderRadius: 3 }} />
        <FlexWidget style={{ flex: props.state === 'idle' ? 100 : Math.max(2, 100 - filled) }} />
      </FlexWidget>

      <TextWidget text={props.sub} style={{ fontSize: 12, color: COLORS.muted }} />
    </FlexWidget>
  );
}
