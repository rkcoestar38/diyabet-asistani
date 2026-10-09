import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

import { EASE_OUT } from '@/components/ui';
import { useTheme } from '@/constants/theme';
import { MAX_GAP, curvePaths, curveSegments, splitByGap } from '@/logic/chart';
import { bgLevelIn, getDayOffset, rangeFor, type BgRanges } from '@/logic/stats';
import type { LogEntry } from '@/logic/types';

const H = 220;
const FONT = Platform.select({ web: 'system-ui, sans-serif', default: undefined });
const TR_DAYS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

/**
 * Şeker ölçümleri; hedef bant gün boyu 80–180 optimal aralığında uzanır.
 * Ölçüm noktaları kendi bağlamına göre renk alır:
 * - Açlık veya sabah ölçümü: 80–120 yeşil, dışındakiler kırmızı
 * - Tokluk ölçümü (yemek sonrası 3 saat): 80–180 yeşil, dışındakiler kırmızı
 * Sol eksende 80 ve 250 yazmaz (yalnızca 70 ve 180 yazılır).
 */
export function BgChart({
  entries,
  all,
  ranges,
  dayStart,
  hypo = 70,
  days = 1,
  isWeek = false,
}: {
  entries: LogEntry[];
  all?: LogEntry[];
  ranges: BgRanges;
  dayStart: number;
  hypo?: number;
  days?: number;
  isWeek?: boolean;
}) {
  const c = useTheme();
  const [w, setW] = useState(0);
  const bgs = entries.filter((e) => e.bg !== undefined).sort((a, b) => (a.bgTime ?? a.time) - (b.bgTime ?? b.time));
  const maxBg = Math.max(250, ...bgs.map((e) => e.bg!)) + 10;
  const minBg = 40;
  const single = days === 1;
  const PAD = { l: 34, r: 12, t: 12, b: single ? 36 : 26 };
  const plotW = Math.max(0, w - PAD.l - PAD.r);
  const plotH = H - PAD.t - PAD.b;
  const x = (t: number) => PAD.l + ((t - dayStart) / (86400000 * days)) * plotW;
  const xm = (min: number) => PAD.l + (min / (1440 * days)) * plotW;
  const y = (bg: number) => PAD.t + (1 - (Math.min(Math.max(bg, minBg), maxBg) - minBg) / (maxBg - minBg)) * plotH;

  const at = (e: LogEntry) => e.bgTime ?? e.time;
  const end = dayStart + days * 86400000;
  const ctx = all ?? entries;
  const startMin = getDayOffset();

  // Çizgiler: 70 (hipo, etiketli), 80 (hedef tabanı, etiketsiz), 120 (açlık tavanı, etiketsiz), 180 (hedef tavanı, etiketli), 250 (hiper, etiketsiz)
  const gridValues = (() => {
    type GridItem = { v: number; isHypo?: boolean; isTarget?: boolean; isFastingHigh?: boolean; isHyper?: boolean; showLabel: boolean };
    const raw: GridItem[] = [
      { v: hypo, isHypo: true, showLabel: true },
      { v: ranges.fastingRange.low, isTarget: true, showLabel: false }, // 80 - çizgi var, etiket yok
      { v: ranges.fastingRange.high, isFastingHigh: true, showLabel: false }, // 120 - kılavuz çizgi, etiket yok
      { v: ranges.postRange.high, isTarget: true, showLabel: true }, // 180 - çizgi var, etiket var
      { v: 250, isHyper: true, showLabel: false }, // 250 - çizgi var, etiket yok
    ];
    const unique = new Map<number, GridItem>();
    for (const item of raw) {
      // Aynı değerde çizgiler çakışırsa roller birleşsin: hipo çizgisi ve etiketi kaybolmasın
      const prev = unique.get(item.v);
      unique.set(item.v, prev ? { ...prev, ...item, showLabel: prev.showLabel || item.showLabel } : item);
    }
    return Array.from(unique.values()).sort((a, b) => a.v - b.v);
  })();

  const baseY = H - PAD.b;
  // Eğri: görünümdeki ölçümler + kenarlardaki komşu ölçümler (önceki/sonraki gün)
  const others = (all ?? []).filter((e) => e.bg !== undefined);
  const before = others.filter((e) => at(e) < dayStart).reduce<LogEntry | undefined>((p, e) => (!p || at(e) > at(p) ? e : p), undefined);
  const after = others.filter((e) => at(e) >= end).reduce<LogEntry | undefined>((p, e) => (!p || at(e) < at(p) ? e : p), undefined);

  // Her ölçümün rengi kendi bağlamına göre (açlıkta 80-120 yeşil, toklukta 80-180 yeşil; dışı kırmızı)
  const color = (e: LogEntry) => c[bgLevelIn(e.bg!, rangeFor(e, ctx, ranges), hypo)];
  const line = [before, ...bgs, after].filter((e): e is LogEntry => !!e).map((e) => ({ t: at(e), x: x(at(e)), y: y(e.bg!), color: color(e) }));
  const runs = splitByGap(line, MAX_GAP)
    .filter((r) => r.length > 1)
    .map((r) => ({
      area: curvePaths(r, baseY, undefined, true, PAD.t, baseY).area,
      segs: curveSegments(r, undefined, true, PAD.t, baseY).map((g) => ({ ...g, from: r[g.i], to: r[g.i + 1] })),
    }));

  // Gün/hafta değişince veya yeni ölçüm gelince eğri soldan sağa akarak çizilir
  const reduce = useReducedMotion();
  const reveal = useSharedValue(1);
  const replay = `${dayStart}-${days}-${bgs.length}`;
  useEffect(() => {
    if (reduce) return;
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 800, easing: EASE_OUT });
  }, [replay, reduce, reveal]);
  const EDGE = 6;
  const clipW = plotW + 2 * EDGE;
  const revealStyle = useAnimatedStyle(() => ({ width: reveal.value * clipW }));

  // Birbirine çok yakın işaretleri birleştir
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

  const strokeW = days > 4 ? 1.7 : days > 1 ? 2.0 : 2.3;

  return (
    <View onLayout={(ev) => setW(ev.nativeEvent.layout.width)} style={{ height: H }}>
      {w > 0 ? (
        <Svg width={w} height={H}>
          {/* Hedef bant: 80 ile 180 arasında yumuşak yeşil şerit */}
          <Rect
            x={PAD.l}
            width={plotW}
            y={y(ranges.postRange.high)}
            height={Math.max(0, y(ranges.fastingRange.low) - y(ranges.postRange.high))}
            fill={c.ok}
            opacity={0.12}
            rx={5}
          />
          {gridValues.map((item) => {
            const isHypo = item.isHypo;
            const isHyper = item.isHyper;
            const isTarget = item.isTarget;
            const strokeColor = isHypo || isHyper ? c.danger : isTarget ? c.ok : c.border;
            const textColor = isHypo || isHyper ? c.danger : isTarget ? c.ok : c.muted;
            const labelYOffset = isHypo ? 7 : 4;
            return (
              <G key={item.v}>
                <Line
                  x1={PAD.l}
                  x2={w - PAD.r}
                  y1={y(item.v)}
                  y2={y(item.v)}
                  stroke={strokeColor}
                  strokeDasharray={isHypo || isHyper ? '3 3' : isTarget ? '5 5' : '2 2'}
                  strokeWidth={isTarget ? 1.1 : 0.8}
                  opacity={isTarget ? 0.7 : 0.35}
                />
                {item.showLabel ? (
                  <SvgText
                    x={PAD.l - 5}
                    y={y(item.v) + labelYOffset}
                    fontSize={10}
                    fontWeight={isTarget ? '700' : 'normal'}
                    fill={textColor}
                    textAnchor="end"
                    fontFamily={FONT}>
                    {item.v}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
          {single ? (
            <>
              {[0, 6, 12, 18, 24].map((h) => (
                <SvgText
                  key={h}
                  x={xm(h * 60)}
                  y={baseY + 14}
                  fontSize={10}
                  fill={c.muted}
                  textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
                  fontFamily={FONT}>
                  {String(Math.floor((startMin / 60 + h) % 24)).padStart(2, '0')}
                </SvgText>
              ))}
              {isWeek ? (
                <SvgText
                  x={w - PAD.r}
                  y={PAD.t + 11}
                  fontSize={11}
                  fontWeight="700"
                  fill={c.primary}
                  textAnchor="end"
                  fontFamily={FONT}>
                  {`${TR_DAYS[new Date(dayStart).getDay()]} ${new Date(dayStart).getDate()}`}
                </SvgText>
              ) : null}
            </>
          ) : (
            Array.from({ length: days }, (_, d) => {
              const t = new Date(dayStart + d * 86400000);
              const show = days <= 7 || d % 5 === 0 || d === days - 1;
              return (
                <G key={d}>
                  {d > 0 ? (
                    <Line
                      x1={xm(d * 1440)}
                      x2={xm(d * 1440)}
                      y1={PAD.t}
                      y2={baseY}
                      stroke={c.border}
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      opacity={0.5}
                    />
                  ) : null}
                  {show ? (
                    <SvgText
                      x={xm(d * 1440 + 720)}
                      y={baseY + 14}
                      fontSize={10}
                      fill={c.muted}
                      textAnchor="middle"
                      fontFamily={FONT}>
                      {days <= 7 ? `${TR_DAYS[t.getDay()]} ${t.getDate()}` : String(t.getDate())}
                    </SvgText>
                  ) : null}
                </G>
              );
            })
          )}
          {(single ? boluses : []).map((m) => (
            <SvgText
              key={`b${m.x}`}
              x={m.x}
              y={baseY + 25}
              fontSize={10}
              fill={c.info}
              textAnchor="middle"
              fontWeight="bold"
              fontFamily={FONT}>
              {`${Math.round(m.v * 10) / 10}Ü`}
            </SvgText>
          ))}
          {(single ? carbMarks : []).map((m) => (
            <SvgText
              key={`c${m.x}`}
              x={m.x}
              y={baseY + 36}
              fontSize={10}
              fill={m.hypo ? c.danger : c.warn}
              textAnchor="middle"
              fontFamily={FONT}>
              {`${m.v}g`}
            </SvgText>
          ))}
        </Svg>
      ) : null}
      {/* Çizgi, degrade ve noktalar - Defs bu SVG içinde tanımlandığı için Android ve Web üzerinde tam renk geçişiyle kusursuz render edilir */}
      {w > 0 ? (
        <Animated.View
          style={[{ position: 'absolute', left: PAD.l - EDGE, top: 0, height: H, overflow: 'hidden' }, revealStyle]}
          pointerEvents="none">
          <Svg width={w} height={H} style={{ marginLeft: -(PAD.l - EDGE) }}>
            <Defs>
              <LinearGradient id="trendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={c.primary} stopOpacity={0.18} />
                <Stop offset="100%" stopColor={c.primary} stopOpacity={0.01} />
              </LinearGradient>
              {runs.flatMap((r, ri) =>
                r.segs.map((s, si) => (
                  <LinearGradient
                    key={`g-${ri}-${si}`}
                    id={`grad-${ri}-${si}`}
                    x1={s.from.x}
                    y1={s.from.y}
                    x2={s.to.x}
                    y2={s.to.y}
                    gradientUnits="userSpaceOnUse">
                    <Stop offset="0%" stopColor={s.from.color} />
                    <Stop offset="100%" stopColor={s.to.color} />
                  </LinearGradient>
                )),
              )}
            </Defs>
            {runs.map((r, ri) => (
              <G key={`r-${ri}`}>
                <Path d={r.area} fill="url(#trendAreaGrad)" />
                {r.segs.map((s, si) => (
                  <Path
                    key={`s-${ri}-${si}`}
                    d={s.d}
                    stroke={`url(#grad-${ri}-${si})`}
                    strokeWidth={strokeW}
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </G>
            ))}
            {/* Noktalar: çoklu günlerde sıkışıklığı önleyen zarif, kompakt boyutlandırma */}
            {line
              .filter((pt) => pt.t >= dayStart && pt.t < end)
              .map((pt) => {
                const isOut = pt.color === c.danger || pt.color === c.warn;
                const isLong = days > 4;
                const isMulti = days > 1;
                const rDot = isLong ? (isOut ? 2.5 : 1.8) : isMulti ? (isOut ? 2.9 : 2.2) : (isOut ? 3.8 : 3.0);
                const rRing = isLong ? (isOut ? 3.6 : 2.5) : isMulti ? (isOut ? 4.0 : 3.2) : (isOut ? 5.2 : 4.2);

                return (
                  <G key={`pt-${pt.t}`}>
                    {!isLong || isOut ? (
                      <Circle cx={pt.x} cy={pt.y} r={rRing} fill={c.card} opacity={0.9} />
                    ) : null}
                    <Circle cx={pt.x} cy={pt.y} r={rDot} fill={pt.color} />
                  </G>
                );
              })}
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}
