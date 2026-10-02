import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Btn, Card, KV, Notice, T, confirm, notify } from '@/components/ui';
import { Radius, Space, useTheme } from '@/constants/theme';
import { useNow } from '@/lib/hooks';
import { fmt } from '@/logic/bolus';
import { RECENT_DAYS, basalSentence, basalSummary, blockSuggestions, evaluate, fastingWindows, mealGroupStats, periodSeries, recentEval, trendOf, trendSentence } from '@/logic/optimizer';
import { MAX_CHANGE, MIN_SAMPLES, type Suggestion } from '@/logic/ratios';
import { blockEnd } from '@/logic/schedule';
import { useLog } from '@/store/log';
import { useSettings } from '@/store/settings';
import { useTests } from '@/store/tests';

const shortDate = (t: number) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

/** Bir saat dilimi için oran önerisi ve "Ayarlara uygula" (onaysız hiçbir şey değişmez) */
export function SuggestionView({ kind, s, blockId }: { kind: 'icr' | 'isf'; s: Suggestion; blockId: string }) {
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

/** Kayıtlardan sürekli hesaplanan oran ve bazal gidişatı: öğün bazında, dönem bazında ve öneriler (hiçbiri kendiliğinden uygulanmaz) */
export function RatioTrend() {
  const now = useNow(60000);
  const entries = useLog((s) => s.entries);
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const setTimeBlocks = useSettings((s) => s.setTimeBlocks);
  const finished = useTests((s) => s.finished);
  const all = evaluate(entries, settings, now);
  const ev = recentEval(all, now); // öneriler yalnızca son haftaların kayıtlarından
  const tIcr = trendOf(all.icr, now);
  const tIsf = trendOf(all.isf, now);
  const groups = mealGroupStats(ev.icr, 'icr').filter((g) => g.n > 0);
  const periods = periodSeries(all, now).filter((p) => p.icr.n > 0 || p.isf.n > 0);
  const windows = fastingWindows(entries, settings, now);
  const basal = basalSummary(windows, settings.basalDose);
  const icrSug = blockSuggestions(ev.icr, settings.blocks, 'icr');
  const isfSug = blockSuggestions(ev.isf, settings.blocks, 'isf');
  const used = all.icr.length + all.isf.length;
  const total = all.candidates.icr + all.candidates.isf;
  const observed = groups.filter((g) => g.observed !== undefined).map((g) => g.observed!);
  const spread = observed.length >= 2 ? Math.max(...observed) / Math.min(...observed) : 1;
  const level = (v: string) => (v === 'more' || v === 'less' ? 'warn' : 'info');
  const suggestions = [...icrSug.map((s) => ({ s, kind: 'icr' as const })), ...isfSug.map((s) => ({ s, kind: 'isf' as const }))].filter(({ s }) => s.suggested !== undefined);
  const basalTests = finished.filter((t) => t.kind === 'basal').length;

  return (
    <>
      <Card title="Oran gidişatı" icon="trending-up">
        <T variant="muted">
          Her gün girdiğin yemek, doz ve şeker kayıtlarından oranlarının gerçekte nasıl çalıştığı sürekli hesaplanır. Vücudundaki değişiklikler oranlarını etkilediyse burada
          görürsün. Öneriler son {RECENT_DAYS / 7} haftanın kayıtlarından hesaplanır ve hiçbir değişiklik kendiliğinden uygulanmaz.
        </T>
        <Notice level={level(tIcr.verdict)} text={trendSentence('icr', tIcr)} />
        <Notice level={level(tIsf.verdict)} text={trendSentence('isf', tIsf)} />
        <T variant="small">
          {total > 0
            ? `${total} yemek/düzeltme kaydından ${used}’i analize uygun${all.pending ? `, ${all.pending}’i henüz bekleniyor` : ''}.`
            : 'Henüz analiz edilecek yemek veya düzeltme kaydı yok.'}
        </T>
      </Card>

      {groups.length > 0 ? (
        <Card title="Öğünlere göre karbonhidrat oranı" icon="restaurant-outline">
          <View style={styles.trow}>
            <T variant="small" style={{ flex: 1.4 }}>
              Öğün
            </T>
            <T variant="small" style={styles.tnum}>
              Ayarlı
            </T>
            <T variant="small" style={styles.tnum}>
              Gerçek
            </T>
            <T variant="small" style={styles.tnum}>
              Kayıt
            </T>
          </View>
          {groups.map((g) => {
            const diff = g.suggested !== undefined && g.current !== undefined ? g.suggested - g.current : 0;
            return (
              <View key={g.key}>
                <View style={styles.trow}>
                  <T style={{ flex: 1.4, fontWeight: '600' }}>{g.label}</T>
                  <T style={styles.tnum}>{g.current !== undefined ? fmt(g.current) : '—'}</T>
                  <T style={styles.tnum}>{g.observed !== undefined ? fmt(g.observed) : '—'}</T>
                  <T style={styles.tnum} color={g.n < MIN_SAMPLES ? 'muted' : undefined}>
                    {g.n}
                  </T>
                </View>
                {g.suggested !== undefined && Math.abs(diff) >= 0.5 ? (
                  <T variant="small" color="warn">
                    Öneri: {fmt(g.suggested)} g/Ü ({diff < 0 ? 'daha fazla' : 'daha az'} insülin)
                  </T>
                ) : g.suggested !== undefined ? (
                  <T variant="small" color="ok">
                    Ayarlı oran bu öğünde iyi çalışıyor.
                  </T>
                ) : (
                  <T variant="small">Öneri için en az {MIN_SAMPLES} uygun kayıt gerekli.</T>
                )}
              </View>
            );
          })}
          {settings.blocks.length === 1 && spread >= 1.2 ? (
            <>
              <Notice
                level="info"
                text="Öğünler arasında gerçekleşen oran belirgin farklı. Saate göre ayrı oranlar açarsan her öğün kendi oranıyla hesaplanır ve öneriler dilim dilim uygulanır."
              />
              <Btn
                small
                variant="secondary"
                icon="time-outline"
                title="Saate göre ayrı oranları aç"
                onPress={() =>
                  confirm('Saate göre ayrı oranlar', 'Mevcut oranlar 4 saat dilimine (sabah, öğle, akşam, gece) kopyalanır. Sonra her dilimi ayarlayabilirsin.', () => setTimeBlocks(true), 'Aç')
                }
              />
            </>
          ) : null}
        </Card>
      ) : null}

      {suggestions.map(({ s, kind }) => {
        const b = settings.blocks.find((x) => x.id === s.blockId)!;
        return (
          <Card key={`${kind}-${s.blockId}`} title={settings.blocks.length > 1 ? `${b.name} · ${b.start}–${blockEnd(settings.blocks, b)}` : 'Tüm gün'} icon="time-outline">
            <SuggestionView kind={kind} s={s} blockId={s.blockId} />
          </Card>
        );
      })}

      {periods.length > 0 ? (
        <Card title="Dönemlere göre değişim (14 gün)" icon="calendar">
          <View style={styles.trow}>
            <T variant="small" style={{ flex: 1.3 }}>
              Dönem
            </T>
            <T variant="small" style={[styles.tnum, { flex: 1 }]}>
              KH oranı
            </T>
            <T variant="small" style={[styles.tnum, { flex: 1 }]}>
              Düzeltme
            </T>
          </View>
          {periods.map((p) => (
            <View key={p.to} style={styles.trow}>
              <T style={{ flex: 1.3 }}>
                {shortDate(p.from + 1)} – {shortDate(p.to)}
              </T>
              <T style={[styles.tnum, { flex: 1 }]}>
                {p.icr.value !== undefined ? `${fmt(p.icr.value)} g` : '—'} ({p.icr.n})
              </T>
              <T style={[styles.tnum, { flex: 1 }]}>
                {p.isf.value !== undefined ? fmt(p.isf.value, 0) : '—'} ({p.isf.n})
              </T>
            </View>
          ))}
          <T variant="small">Parantez içi uygun kayıt sayısı. Bir dönemde en az 2 kayıt varsa değer gösterilir.</T>
        </Card>
      ) : null}

      <Card title="Bazal insülin gidişatı" icon="moon">
        <Notice level={basal.verdict === 'rising' || basal.verdict === 'falling' ? 'warn' : 'info'} text={basalSentence(basal)} />
        {basal.suggestedDose !== undefined ? (
          <>
            <KV k={`Ayarlı bazal doz (${settings.basalName || 'bazal'})`} v={`${fmt(settings.basalDose)} Ü`} />
            <KV k="Değerlendirilebilecek doz (≈ %10)" v={`${fmt(basal.suggestedDose)} Ü`} strong />
            <Btn
              small
              variant="secondary"
              title="Bazal dozumu güncelle"
              onPress={() =>
                confirm(
                  'Bazal doz',
                  `Ayarlardaki bazal doz ${fmt(settings.basalDose)} → ${fmt(basal.suggestedDose!)} Ü olarak değişecek. Bazal değişikliğini doktorunla da konuş.`,
                  () => update({ basalDose: basal.suggestedDose! }),
                  'Uygula',
                )
              }
            />
          </>
        ) : null}
        {windows
          .slice(-5)
          .reverse()
          .map((w) => (
            <T key={w.from} variant="small">
              {shortDate(w.from)}: {w.fromBg} → {w.toBg} mg/dL ({w.hours} sa, {w.drift > 0 ? '+' : ''}
              {w.drift})
            </T>
          ))}
        <T variant="small">
          Yalnızca gece yemeksiz ve hızlı insülin etkisi bitmişken yapılan iki ölçüm (en az 4 saat arayla, 20:00–04:00 arasında başlayan ve başlangıç şekeri 180’i aşmayan) hesaba katılır.
          {basalTests ? ` ${basalTests} rehberli bazal testin raporda yer alır.` : ''}
        </T>
        <Btn small variant="ghost" icon="flask" title="Rehberli bazal testi yap" onPress={() => router.push({ pathname: '/test', params: { kind: 'basal' } })} />
      </Card>

      {all.rejected.length > 0 ? (
        <Card title="Daha çok kayıt analize girsin" icon="bulb">
          <T variant="muted">Analize girmeyen kayıtların başlıca nedenleri ve ne yapabileceğin:</T>
          {all.rejected.slice(0, 4).map((r) => (
            <View key={r.reason} style={{ gap: 2 }}>
              <T style={{ fontWeight: '600' }}>
                {r.reason} ({r.count})
              </T>
              {r.tip ? <T variant="small">{r.tip}</T> : null}
            </View>
          ))}
        </Card>
      ) : null}

      <Btn variant="secondary" icon="document-text-outline" title="Gidişatı doktor raporunda gör (PDF)" onPress={() => router.push('/report' as Href)} />
    </>
  );
}

const styles = StyleSheet.create({
  trow: { flexDirection: 'row', alignItems: 'center', gap: Space.xs, paddingVertical: 6 },
  tnum: { flex: 0.8, textAlign: 'right', fontVariant: ['tabular-nums'] },
  sugg: { borderRadius: Radius.md, padding: Space.md, gap: Space.xs },
});
