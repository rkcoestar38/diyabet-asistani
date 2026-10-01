import Ionicons from "@expo/vector-icons/Ionicons";
import { router, type Href } from "expo-router";
import { View } from "react-native";

import { UpdateBanner } from "@/components/update-banner";
import { Card, Pressy, T, Screen, type IconName } from "@/components/ui";
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
import { awaitingPost } from "@/logic/postmeal";
import { activeBlock } from "@/logic/schedule";
import { startOfDay } from "@/logic/stats";
import { useLog } from "@/store/log";
import { useSettings } from "@/store/settings";

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

  const steps: { done: boolean; text: string; to: string }[] = [
    {
      done: entries.some((e) => e.bg !== undefined),
      text: "İlk şekerini kaydet",
      to: "/entry",
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
          onPress={() => go("/entry")}
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

      <T variant="h2">Öğren ve ayarla</T>
      <Pressy
        onPress={() => go("/learn")}
        accessibilityRole="button"
        style={rowStyle(c)}
      >
        <Ionicons name="school" size={22} color={c.primary} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Oranlarımı öğren</T>
          <T variant="small">
            Karbonhidrat oranını ve düzeltme faktörünü kendi verinle bul;
            karbonhidrat saymayı öğren.
          </T>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.muted} />
      </Pressy>
      <Pressy
        onPress={() => go("/settings")}
        accessibilityRole="button"
        style={rowStyle(c)}
      >
        <Ionicons name="settings" size={22} color={c.primary} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: "700" }}>Ayarlar</T>
          <T variant="small">
            Oranlar, insülin adı, bazal, öğün saatleri, tema ve yedekleme.
          </T>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.muted} />
      </Pressy>
    </Screen>
  );
}

const rowStyle = (c: ReturnType<typeof useTheme>) => ({
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: Space.md,
  padding: Space.md,
  borderRadius: Radius.lg,
  backgroundColor: c.card,
});
