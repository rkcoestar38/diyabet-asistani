import { parseHHMM } from './schedule';
import type { LogEntry, MealType } from './types';

export const MEALS: { id: MealType; label: string; short: string; icon: string }[] = [
  { id: 'sabah', label: 'Sabah', short: 'Sabah', icon: 'sunny' },
  { id: 'sabahAra', label: 'Sabah ara öğün', short: 'Sabah ara', icon: 'cafe' },
  { id: 'ogle', label: 'Öğle', short: 'Öğle', icon: 'restaurant' },
  { id: 'ogleAra', label: 'Öğle ara öğün', short: 'Öğle ara', icon: 'nutrition' },
  { id: 'aksam', label: 'Akşam yemeği', short: 'Akşam', icon: 'moon' },
  { id: 'aksamAra', label: 'Akşam ara öğün', short: 'Akşam ara', icon: 'ice-cream' },
  { id: 'gece', label: 'Gece 3', short: 'Gece 3', icon: 'cloudy-night' },
];

/** Varsayılan başlangıçlar; Ayarlar'dan değiştirilebilir. Gece 3: gece yarısından sabaha kadar. */
export const DEFAULT_MEAL_STARTS: Record<MealType, string> = {
  gece: '00:00',
  sabah: '06:00',
  sabahAra: '09:30',
  ogle: '12:00',
  ogleAra: '15:00',
  aksam: '18:30',
  aksamAra: '21:00',
};

export function mealLabel(id: MealType | undefined): string {
  return MEALS.find((m) => m.id === id)?.label ?? '';
}

/** Verilen andaki öğün: başlangıcı en yakın geçmişte kalan öğün (gece yarısını aşarak) */
export function mealAt(time: number, starts: Record<MealType, string> = DEFAULT_MEAL_STARTS): MealType {
  const d = new Date(time);
  const now = d.getHours() * 60 + d.getMinutes();
  const list = MEALS.map((m) => ({ id: m.id, start: parseHHMM(starts[m.id] ?? DEFAULT_MEAL_STARTS[m.id]) })).filter((m) => !Number.isNaN(m.start));
  if (list.length === 0) return 'sabah';
  list.sort((a, b) => a.start - b.start);
  let found = list[list.length - 1];
  for (const m of list) if (m.start <= now) found = m;
  return found.id;
}

/** Kaydın öğünü: elle seçilmişse o, yoksa saatinden */
export function entryMeal(e: LogEntry, starts: Record<MealType, string>): MealType {
  return e.meal ?? mealAt(e.time, starts);
}

export function mealRange(id: MealType, starts: Record<MealType, string>): string {
  const sorted = [...MEALS].sort((a, b) => parseHHMM(starts[a.id]) - parseHHMM(starts[b.id]));
  const i = sorted.findIndex((m) => m.id === id);
  return `${starts[id]}–${starts[sorted[(i + 1) % sorted.length].id]}`;
}

/** Aynı öğünde daha önce yenenler (en yeniden eskiye, günde bir kez) — "geçen seferki gibi" için */
export function previousMeals(entries: LogEntry[], meal: MealType, starts: Record<MealType, string>, before: number, limit = 3): LogEntry[] {
  const seen = new Set<string>();
  const out: LogEntry[] = [];
  for (const e of [...entries].sort((a, b) => b.time - a.time)) {
    if (e.time >= before || !e.items?.length || entryMeal(e, starts) !== meal) continue;
    const day = new Date(e.time).toDateString();
    if (seen.has(day)) continue;
    seen.add(day);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

/** Öğün başlangıç saatlerindeki format, çakışma ve kronolojik sıralama hatalarını kontrol eder */
export function mealScheduleProblems(starts: Record<MealType, string>): string[] {
  const problems: string[] = [];
  const times: { id: MealType; label: string; min: number }[] = [];

  for (const m of MEALS) {
    const val = starts[m.id];
    const minutes = parseHHMM(val);
    if (Number.isNaN(minutes) || !/^\d{2}:\d{2}$/.test(val)) {
      problems.push(`${m.label} saati geçersiz (${val ?? ''}); SS:DD formatında olmalı`);
    } else {
      times.push({ id: m.id, label: m.label, min: minutes });
    }
  }

  // Aynı başlangıç saatine sahip öğünler
  const seen = new Map<number, string>();
  for (const t of times) {
    const existing = seen.get(t.min);
    if (existing) {
      problems.push(`"${existing}" ve "${t.label}" aynı saatte (${starts[t.id]}) başlıyor; saatleri farklı olmalı`);
    } else {
      seen.set(t.min, t.label);
    }
  }

  // Gündüz öğünleri için kronolojik sıra: sabah -> sabahAra -> ogle -> ogleAra -> aksam -> aksamAra
  const daytimeSequence: MealType[] = ['sabah', 'sabahAra', 'ogle', 'ogleAra', 'aksam', 'aksamAra'];
  for (let i = 0; i < daytimeSequence.length - 1; i++) {
    const curId = daytimeSequence[i];
    const nextId = daytimeSequence[i + 1];
    const curTime = parseHHMM(starts[curId]);
    const nextTime = parseHHMM(starts[nextId]);
    if (!Number.isNaN(curTime) && !Number.isNaN(nextTime) && curTime >= nextTime) {
      const curMeal = MEALS.find((m) => m.id === curId)!;
      const nextMeal = MEALS.find((m) => m.id === nextId)!;
      problems.push(`"${curMeal.label}" (${starts[curId]}), "${nextMeal.label}" (${starts[nextId]}) öğününden önce başlamalı`);
    }
  }

  return problems;
}

