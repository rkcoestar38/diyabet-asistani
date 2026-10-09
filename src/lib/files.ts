import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { DEFAULT_MEAL_STARTS, MEALS, entryMeal } from '@/logic/meals';
import type { LogEntry, MealType } from '@/logic/types';

/** Metni dosya olarak paylaşır (telefonda paylaşım menüsü, tarayıcıda indirme). */
export async function shareText(filename: string, content: string, mimeType: string) {
  if (Platform.OS === 'web') {
    // iPhone/Android tarayıcıda önce paylaşım menüsü (Dosyalar'a kaydet, iCloud...), yoksa indirme
    const file = new window.File([content], filename, { type: mimeType });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: filename });
      return;
    }
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: filename });
}

/** Kullanıcının seçtiği bir metin dosyasını okur. İptalde undefined. */
export async function pickText(): Promise<string | undefined> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/*', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return undefined;
  const asset = res.assets[0];
  if (Platform.OS === 'web') {
    if (asset.file) return asset.file.text();
    return (await fetch(asset.uri)).text();
  }
  return new File(asset.uri).text();
}

const csvCell = (v: unknown) => {
  if (v === undefined || v === null) return '';
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const exerciseTr = { none: '', light: 'hafif', moderate: 'orta', intense: 'yoğun' } as const;

/** Excel (Türkçe) uyumlu: ; ayraçlı, ondalık virgül */
export function toCsv(entries: LogEntry[], starts: Record<MealType, string> = DEFAULT_MEAL_STARTS): string {
  const num = (n?: number) => (n === undefined ? '' : String(n).replace('.', ','));
  const header = ['Tarih', 'Saat', 'Öğün', 'Şeker (mg/dL)', 'Ölçüm saati', 'Karbonhidrat (g)', 'Hızlı insülin (Ü)', 'Bazal (Ü)', 'Hipo KH (g)', 'Keton', 'Egzersiz', 'Yemekler', 'Not'];
  const rows = entries.map((e) => {
    const d = new Date(e.time);
    return [
      d.toLocaleDateString('tr-TR'),
      d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      MEALS.find((m) => m.id === entryMeal(e, starts))?.label ?? '',
      num(e.bg),
      e.bg !== undefined ? new Date(e.bgTime ?? e.time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '',
      num(e.carbs),
      num(e.bolus),
      num(e.basal),
      num(e.hypoCarbs),
      num(e.ketones),
      e.exercise ? exerciseTr[e.exercise] : '',
      e.foods,
      e.note,
    ].map(csvCell).join(';');
  });
  return String.fromCharCode(0xfeff) + [header.join(';'), ...rows].join('\n');
}

/** Web'de HTML raporunu yeni pencerede/sekmede tam ekran açar */
export function openHtmlReport(html: string, _title = 'Diyabet Raporu') {
  if (Platform.OS === 'web') {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (!win) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

/** HTML'den PDF üretip paylaşır (telefonda paylaşım menüsü, tarayıcıda yazdır/PDF kaydet veya yeni sekmede aç). */
export async function sharePdf(html: string, filename: string) {
  if (Platform.OS === 'web') {
    try {
      const Print = await import('expo-print');
      await Print.printAsync({ html });
      return;
    } catch {
      // Tarayıcı güvenlik veya sandbox kısıtlaması nedeniyle printAsync hata verirse güvenli şekilde yeni sekmede aç
      openHtmlReport(html, filename);
      return;
    }
  }
  const Print = await import('expo-print');
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  // Anlamlı bir dosya adı için kopyalamayı dene; izin/okuma hatası olursa özgün dosyayı paylaş.
  let shareUri = uri;
  try {
    const named = new File(Paths.cache, filename);
    if (named.exists) named.delete();
    new File(uri).copy(named);
    shareUri = named.uri;
  } catch {
    shareUri = uri;
  }
  await Sharing.shareAsync(shareUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: filename });
}
