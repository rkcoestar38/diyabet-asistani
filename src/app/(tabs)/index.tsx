import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { UpdateBanner } from "@/components/update-banner";
import { BackupReminder, InstallHint } from "@/components/web-hints";
import { Btn, Card, Pressy, T, Screen, type IconName } from "@/components/ui";
import {
  Radius,
  Space,
  elevation,
  useScheme,
  useTheme,
} from "@/constants/theme";
import { useIob, useNow } from "@/lib/hooks";
import { fmt } from "@/logic/bolus";
import { mealAt, mealLabel } from "@/logic/meals";
import { attention, evaluate } from "@/logic/optimizer";
import { awaitingPost } from "@/logic/postmeal";
import { activeBlock, parseHHMM } from "@/logic/schedule";
import { startOfDay } from "@/logic/stats";
import { useLog } from "@/store/log";
import { useSettings } from "@/store/settings";
import { toast } from "@/store/toast";

const go = (path: string) => router.navigate(path as Href);

function greeting(h: number) {
  if (h < 6) return "İyi geceler";
  if (h < 12) return "Günaydın";
  if (h < 18) return "Merhaba";
  return "İyi akşamlar";
}

function ago(min: number) {
  if (min < 1) return "şimdi";
  if (min < 60) return `${Math.round(min)} dk önce`;
  if (min < 1440)
    return `${Math.floor(min / 60)} sa ${Math.round(min % 60)} dk önce`;
  return `${Math.floor(min / 1440)} gün önce`;
}

/** Büyük, tek işlevli kısayol: ne işe yaradığı yazıyla da anlatılır */
function Tile({
  icon,
  title,
  hint,
  onPress,
  tone = "normal",
}: {
  icon: IconName;
  title: string;
  hint: string;
  onPress: () => void;
  tone?: "primary" | "danger" | "normal";
}) {
  const c = useTheme();
  const scheme = useScheme();
  const bg =
    tone === "primary" ? c.primary : tone === "danger" ? c.dangerBg : c.card;
  const fg =
    tone === "primary" ? c.onPrimary : tone === "danger" ? c.danger : c.text;
  const sub = tone === "primary" ? c.onPrimary : c.muted;
  const iconBg =
    tone === "primary"
      ? "rgba(255,255,255,0.2)"
      : tone === "danger"
        ? c.card
        : c.primarySoft;
  const iconFg =
    tone === "primary" ? c.onPrimary : tone === "danger" ? c.danger : c.primary;
  return (
    <View style={{ flexBasis: "46%", flexGrow: 1 }}>
      <Pressy
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${hint}`}
        style={[
          elevation(scheme),
          {
            minHeight: 128,
            borderRadius: Radius.lg,
            padding: Space.md,
            gap: 6,
            backgroundColor: bg,
            borderWidth: scheme === "dark" && tone === "normal" ? 1 : 0,
            borderColor: c.border,
          },
        ]}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBg,
          }}
        >
          <Ionicons name={icon} size={22} color={iconFg} />
        </View>
        <T variant="h2" style={{ color: fg }}>
          {title}
        </T>
        <T variant="small" style={{ color: sub }}>
          {hint}
        </T>
      </Pressy>
    </View>
  );
}

export default function Home() {
  const c = useTheme();
  const now = useNow(30000);
  const settings = useSettings((s) => s.settings);
  const entries = useLog((s) => s.entries);
  const iob = useIob(now);

  const lastBg = [...entries]
    .reverse()
    .find((e) => e.bg !== undefined && (e.bgTime ?? e.time) <= now);
  const lastTime = lastBg ? (lastBg.bgTime ?? lastBg.time) : undefined;
  const block = activeBlock(settings.blocks, new Date(now));
  const bgTone = !lastBg
    ? "muted"
    : lastBg.bg! < settings.hypoThreshold
      ? "danger"
      : block && lastBg.bg! > block.high
        ? "warn"
        : "ok";
  const bgNote = !lastBg
    ? ""
    : bgTone === "danger"
      ? "Düşük"
      : bgTone === "warn"
        ? "Hedefin üstünde"
        : "Hedef aralıkta";

  const today = startOfDay(now);
  const todays = entries.filter((e) => e.time >= today);
  const carbs = Math.round(
    todays.reduce((s, e) => s + (e.carbs ?? 0) + (e.hypoCarbs ?? 0), 0),
  );
  const bolus = todays.reduce((s, e) => s + (e.bolus ?? 0), 0);
  const waiting = awaitingPost(entries, now);
  const advice = attention(evaluate(entries, settings, now), settings, now);

  const [basalLater, setBasalLater] = useState(false);
  const basalDue = (() => {
    if (!settings.basalDose || basalLater) return undefined;
    const m = parseHHMM(settings.basalTime);
    if (Number.isNaN(m)) return undefined;
    const d = new Date(now);
    d.setHours(Math.floor(m / 60), m % 60, 0, 0);
    let expected = d.getTime();
    if (expected > now) expected -= 86400000;
    if (now - expected > 14 * 3600000) return undefined;
    if (entries.some((e) => e.basal && e.time >= expected - 6 * 3600000)) return undefined;
    return expected;
  })();

  const steps: { done: boolean; text: string; to: string }[] = [
    {
      done: entries.some((e) => e.bg !== undefined),
      text: "İlk şekerini kaydet",
      to: "/entry?mode=bg",
    },
    {
      done: entries.some((e) => !!e.carbs),
      text: "Bir yemeğin karbonhidratını hesapla",
      to: "/calc",
    },
    {
      done: entries.some((e) => !!e.bolus),
      text: "İlk yemek dozunu kaydet",
      to: "/calc",
    },
    {
      done: settings.basalDose > 0 || entries.some((e) => !!e.basal),
      text: "Bazal insülin dozunu ayarla",
      to: "/settings",
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Screen>
      <UpdateBanner />
      <InstallHint />
      <BackupReminder />
      <View style={{ gap: 2 }}>
        <T variant="title">
          {settings.patientName
            ? `${greeting(new Date(now).getHours())}, ${settings.patientName}`
            : greeting(new Date(now).getHours())}
        </T>
        <T variant="muted">
          Şu an: {mealLabel(mealAt(now, settings.mealStarts))} zamanı
        </T>
      </View>

      <Card>
        <View
          style={{ flexDirection: "row", alignItems: "center", gap: Space.md }}
        >
          <View style={{ flex: 1.2, gap: 2 }}>
            <T variant="label" style={{ marginBottom: 0 }}>
              Son şekerin
            </T>
            <T variant="big" color={bgTone}>
              {lastBg ? lastBg.bg : "—"}
              {lastBg ? <T variant="muted"> mg/dL</T> : null}
            </T>
            <T variant="small" color={bgTone === "muted" ? undefined : bgTone}>
              {lastBg && lastTime !== undefined
                ? `${ago((now - lastTime) / 60000)} · ${bgNote}`
                : "Henüz ölçüm kaydetmedin"}
            </T>
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <View>
              <T variant="small">Aktif insülin</T>
              <T variant="h2">{fmt(iob)} Ü</T>
            </View>
            <View>
              <T variant="small">Bugün</T>
              <T variant="h2">
                {carbs} g · {fmt(bolus)} Ü
              </T>
            </View>
          </View>
        </View>
      </Card>

      {basalDue !== undefined ? (
        <Card title="Bazal insülinini vurdun mu?" icon="moon">
          <T variant="muted">
            {settings.basalName || "Bazal"} · {fmt(settings.basalDose)} Ü · saat{" "}
            {settings.basalTime}
          </T>
          <View style={{ flexDirection: "row", gap: Space.sm }}>
            <Btn
              small
              variant="ghost"
              title="Sonra"
              onPress={() => setBasalLater(true)}
            />
            <Btn
              small
              variant="secondary"
              title="Başka saatte"
              onPress={() =>
                router.push({ pathname: "/entry", params: { basal: "1" } })
              }
              style={{ flexGrow: 1 }}
            />
            <Btn
              small
              icon="checkmark"
              title="Vurdum"
              style={{ flexGrow: 1 }}
              onPress={() => {
                const entry = useLog.getState().add({
                  time: basalDue,
                  basal: settings.basalDose,
                });
                toast(`Bazal ${fmt(settings.basalDose)} Ü kaydedildi`, {
                  label: "Geri al",
                  onPress: () => useLog.getState().remove(entry.id),
                });
              }}
            />
          </View>
        </Card>
      ) : null}

      {waiting ? (
        <Pressy
          onPress={() =>
            router.push({ pathname: "/entry", params: { after: waiting.id } })
          }
          accessibilityRole="button"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: Space.md,
            padding: Space.md,
            borderRadius: Radius.lg,
            backgroundColor: c.infoBg,
          }}
        >
          <Ionicons name="water-outline" size={24} color={c.info} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: "700" }} color="info">
              Tokluk şekerini ölçme zamanı
            </T>
            <T variant="small" color="info">
              {mealLabel(
                waiting.meal ?? mealAt(waiting.time, settings.mealStarts),
              )}{" "}
              yemeğinden {Math.round((now - waiting.time) / 60000)} dk geçti.
              Dokun, değeri yaz.
            </T>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.info} />
        </Pressy>
      ) : null}

      {advice ? (
        <Pressy
          onPress={() => router.navigate({ pathname: '/learn', params: { tab: 'mine' } } as Href)}
          accessibilityRole="button"
          style={{ flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md, borderRadius: Radius.lg, backgroundColor: c.warnBg }}>
          <Ionicons name="trending-up" size={24} color={c.warn} />
          <View style={{ flex: 1 }}>
            <T style={{ fontWeight: '700' }} color="warn">
              Oranların için öneri var
            </T>
            <T variant="small" color="warn">
              {advice} Dokun, gidişatına bak.
            </T>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.warn} />
        </Pressy>
      ) : null}

      <T variant="h2">Ne yapmak istiyorsun?</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: Space.md }}>
        <Tile
          tone="primary"
          icon="restaurant"
          title="Yemek yiyeceğim"
          hint="Karbonhidratı say, insülin dozunu hesapla"
          onPress={() => go("/calc")}
        />
        <Tile
          tone="danger"
          icon="alert-circle"
          title="Şekerim düşük"
          hint="Hipo için adım adım ne yapacağını göster"
          onPress={() => go("/hypo")}
        />
        <Tile
          icon="water"
          title="Şeker ölçtüm"
          hint="Sadece değeri kaydet (açlık, tokluk, gece)"
          onPress={() => go("/entry?mode=bg")}
        />
        <Tile
          icon="nutrition"
          title="Yemek listesi"
          hint="Yiyeceğin kaç gram karbonhidrat olduğuna bak"
          onPress={() => go("/foods")}
        />
        <Tile
          icon="journal"
          title="Günlüğüm"
          hint="Kayıtlarını ve şeker grafiğini gör"
          onPress={() => go("/log")}
        />
        <Tile
          icon="document-text"
          title="Doktor raporu"
          hint="Seçtiğin günlerin PDF raporunu paylaş"
          onPress={() => go("/report")}
        />
      </View>

      {doneCount < steps.length ? (
        <Card
          title={`Başlangıç rehberi (${doneCount}/${steps.length})`}
          icon="flag"
        >
          <T variant="muted">
            Uygulamayı tanımak için sırayla bunları dene. Tamamlananlar
            işaretlenir.
          </T>
          {steps.map((s) => (
            <Pressy
              key={s.text}
              onPress={() => go(s.to)}
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Space.sm,
                paddingVertical: 6,
              }}
            >
              <Ionicons
                name={s.done ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={s.done ? c.ok : c.muted}
              />
              <T
                style={{
                  flex: 1,
                  textDecorationLine: s.done ? "line-through" : "none",
                }}
                color={s.done ? "muted" : "text"}
              >
                {s.text}
              </T>
              {!s.done ? (
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              ) : null}
            </Pressy>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
