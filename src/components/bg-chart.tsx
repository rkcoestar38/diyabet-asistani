import { useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/constants/theme';
import { activeBlock, parseHHMM, sortBlocks } from '@/logic/schedule';
import { bgLevel, getDayOffset, startOfDay, toDayAxis } from '@/logic/stats';
import type { LogEntry, TimeBlock } from '@/logic/types';

const H = 220;
const FONT = Platform.select({ web: 'system-ui, sans-serif', default: undefined });
const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

/**
 * Şeker ölçümleri; hedef aralık bandı saat dilimlerine göre çizilir. `days` = 1: tek gün (altta insülin ve karbonhidrat işaretleri),
 * 7 / 30: hafta ve ay görünümü (altta gün etiketleri). `dayStart` görünümün ilk gününün başlangıcıdır.
 */
export function BgChart({ entries, blocks, dayStart, hypo = 70, days = 1 }: { entries: LogEntry[]; blocks: TimeBlock[]; dayStart: number; hypo?: number; days?: number }) {
  const c = useTheme();
  const [w, setW] = useState(0);
  const bgs = entries.filter((e) => e.bg !== undefined).sort((a, b) => (a.bgTime ?? a.time) - (b.bgTime ?? b.time));
  const maxBg = Math.max(250, ...bgs.map((e) => e.bg!)) + 10;
  const minBg = 40;
  const single = days === 1;
  const PAD = { l: 34, r: 8, t: 10, b: single ? 40 : 24 };
  const plotW = Math.max(0, w - PAD.l - PAD.r);
  const plotH = H - PAD.t - PAD.b;
  const x = (t: number) => PAD.l + ((t - dayStart) / (86400000 * days)) * plotW;
  const xm = (min: number) => PAD.l + (min / (1440 * days)) * plotW;
  const y = (bg: number) => PAD.t + (1 - (Math.min(Math.max(bg, minBg), maxBg) - minBg) / (maxBg - minBg)) * plotH;

  const sorted = sortBlocks(blocks);
  const bands = sorted.flatMap((b, i) => {
    const start = parseHHMM(b.start);
    const next = i + 1 < sorted.length ? parseHHMM(sorted[i + 1].start) : parseHHMM(sorted[0].start) + 1440;
    // Gece yarısını geçen dilim iki parçaya bölünür
    const parts: [number, number][] = next > 1440 ? [[start, 1440], [0, next - 1440]] : [[start, next]];
    return parts.map(([s, e]) => ({ key: `${b.id}-${s}`, s, e, low: b.low, high: b.high }));
  });
  // Bantlar günün başlangıcına göre kaydırılır ve her gün için tekrarlanır
  const dayBands = Array.from({ length: days }, (_, d) =>
    bands.flatMap((b) => toDayAxis(b.s, b.e).map(([s, e], k) => ({ key: `${d}-${b.key}-${k}`, s: d * 1440 + s, e: d * 1440 + e, low: b.low, high: b.high }))),
  ).flat();
  const startMin = getDayOffset();

  // Çizgiler: hipo sınırı, hedef aralığın sınırları ve 250; etiketler üst üste binmesin diye yakın olanlar atlanır
  const gridValues = (() => {
    const vs = [...new Set([hypo, ...sorted.flatMap((b) => [b.low, b.high]), 250])].sort((a, b) => a - b);
    const out: { v: number; label: boolean }[] = [];
    let lastY = Infinity;
    for (const v of vs) {
      const label = lastY - y(v) >= 12 || lastY === Infinity;
      if (label) lastY = y(v);
      out.push({ v, label });
    }
    return out;
  })();
  // Çok günlü görünümde her günün çizgisi ayrı çizilir (günler arasında uzun çizgi olmasın)
  const bgPath = (list: LogEntry[]) => list.map((e, i) => `${i ? 'L' : 'M'}${x(e.bgTime ?? e.time).toFixed(1)},${y(e.bg!).toFixed(1)}`).join(' ');
  const paths = single
    ? [bgPath(bgs)]
    : [...new Set(bgs.map((e) => startOfDay(e.bgTime ?? e.time)))].map((d) => bgPath(bgs.filter((e) => startOfDay(e.bgTime ?? e.time) === d)));
  const baseY = H - PAD.b;

  // Birbirine çok yakın işaretleri birleştir (etiketler üst üste binmesin)
  const group = (values: { t: number; v: number; hypo?: boolean }[]) => {
    const out: { x: number; v: number; hypo: boolean }[] = [];
    for (const m of values) {
      const mx = x(m.t);
      const last = out[out.length - 1];
      if (last && mx - last.x < 26) {
        last.v += m.v;
        last.hypo = last.hypo || !!m.hypo;
      } else out.push({ x: mx, v: m.v, hypo: !!m.hypo });
    }
    return out;
  };
  const boluses = group(entries.filter((e) => e.bolus).map((e) => ({ t: e.time, v: e.bolus! })));
  const carbMarks = group(
    entries.filter((e) => e.carbs || e.hypoCarbs).map((e) => ({ t: e.time, v: (e.carbs ?? 0) + (e.hypoCarbs ?? 0), hypo: !!e.hypoCarbs })),
  );

  return (
    <View onLayout={(ev) => setW(ev.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          {dayBands.map((b) => (
            <Rect key={b.key} x={xm(b.s)} width={xm(b.e) - xm(b.s)} y={y(b.high)} height={y(b.low) - y(b.high)} fill={c.ok} opacity={0.14} />
          ))}
          {gridValues.map((v) => (
            <G key={v.v}>
              <Line x1={PAD.l} x2={w - PAD.r} y1={y(v.v)} y2={y(v.v)} stroke={v.v === hypo ? c.danger : c.border} strokeDasharray="4 4" strokeWidth={1} />
              {v.label ? (
                <SvgText x={PAD.l - 4} y={y(v.v) + 4} fontSize={10} fill={v.v === hypo ? c.danger : c.muted} textAnchor="end" fontFamily={FONT}>
                  {v.v}
                </SvgText>
              ) : null}
            </G>
          ))}
          {single
            ? [0, 6, 12, 18, 24].map((h) => (
                <SvgText key={h} x={xm(h * 60)} y={baseY + 12} fontSize={10} fill={c.muted} textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'} fontFamily={FONT}>
                  {String(Math.floor((startMin / 60 + h) % 24)).padStart(2, '0')}
                </SvgText>
              ))
            : Array.from({ length: days }, (_, d) => {
                const t = new Date(dayStart + d * 86400000);
                const show = days <= 7 || d % 5 === 0 || d === days - 1;
                return (
                  <G key={d}>
                    {d > 0 && (days <= 7 || d % 5 === 0) ? <Line x1={xm(d * 1440)} x2={xm(d * 1440)} y1={PAD.t} y2={baseY} stroke={c.border} strokeWidth={1} /> : null}
                    {show ? (
                      <SvgText x={xm(d * 1440 + 720)} y={baseY + 14} fontSize={10} fill={c.muted} textAnchor="middle" fontFamily={FONT}>
                        {days <= 7 ? `${TR_DAYS[t.getDay()]} ${t.getDate()}` : String(t.getDate())}
                      </SvgText>
                    ) : null}
                  </G>
                );
              })}
          {paths.map((p, i) => (p ? <Path key={i} d={p} stroke={c.muted} strokeWidth={1.5} fill="none" opacity={0.7} /> : null))}
          {bgs.map((e) => (
            <Circle
              key={e.id}
              cx={x(e.bgTime ?? e.time)}
              cy={y(e.bg!)}
              r={single ? 5 : days <= 7 ? 4 : 3}
              fill={c[bgLevel(e.bg!, activeBlock(blocks, new Date(e.bgTime ?? e.time)), hypo)]}
              stroke={c.card}
              strokeWidth={1.5}
            />
          ))}
          {(single ? boluses : []).map((m) => (
            <SvgText key={`b${m.x}`} x={m.x} y={baseY + 25} fontSize={10} fill={c.info} textAnchor="middle" fontWeight="bold" fontFamily={FONT}>
              {`${Math.round(m.v * 10) / 10}Ü`}
            </SvgText>
          ))}
          {(single ? carbMarks : []).map((m) => (
            <SvgText key={`c${m.x}`} x={m.x} y={baseY + 37} fontSize={10} fill={m.hypo ? c.danger : c.warn} textAnchor="middle" fontFamily={FONT}>
              {`${Math.round(m.v)}g`}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
