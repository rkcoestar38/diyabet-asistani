/** Yazarken otomatik biçimlendirme ve ayrıştırma yardımcıları (saat: SS:DD, tarih: GG.AA.YYYY). */

const digitsOf = (s: string, max: number) => s.replace(/\D/g, '').slice(0, max);

/** "9" → "09", "930" → "09:30", "1745" → "17:45"; saat 23, dakika 59 ile sınırlanır. */
export function formatTimeInput(raw: string): string {
  let d = digitsOf(raw, 4);
  if (d.length === 0) return '';
  // Tek rakam 3–9 ise saat olamaz (30+): başına 0 ekle
  if (d.length === 1 && Number(d) > 2) return `0${d}`;
  if (d.length === 3 && Number(d[0]) > 2) d = `0${d}`;
  if (d.length >= 2 && Number(d.slice(0, 2)) > 23) d = `23${d.slice(2)}`;
  if (d.length >= 3 && Number(d[2]) > 5) d = `${d.slice(0, 2)}5${d.slice(3)}`;
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

export function parseTimeInput(s: string): number | undefined {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 23 && min <= 59 ? h * 60 + min : undefined;
}

/** "01102026" → "01.10.2026" */
export function formatDateInput(raw: string): string {
  const d = digitsOf(raw, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

/** "GG.AA.YYYY" → o günün başlangıcı (ms) */
export function parseDateInput(s: string): number | undefined {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return undefined;
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day ? d.getTime() : undefined;
}

export function toDateInput(t: number): string {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function toTimeInput(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Sayıyı ondalık virgülle yaz (Türkçe klavye) */
export function numToInput(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}
