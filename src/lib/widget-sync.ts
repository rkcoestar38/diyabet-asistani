import { Platform } from 'react-native';

/**
 * Android ana ekranındaki Tokluk widget'ının yeniden çizilmesini ister.
 * Uygulama açıkken çağrılır (yemek kaydı, tokluk girişi, ön plana dönüş).
 * Web/iOS/Expo Go'da sessizce hiçbir şey yapmaz.
 */
export function syncToklukWidget() {
  if (Platform.OS !== 'android') return;
  try {
    // Koşullu require: paketin yerel modülü diğer platformlarda yüklenmez
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestWidgetUpdate } = require('react-native-android-widget');
    requestWidgetUpdate({ widgetName: 'Tokluk' });
  } catch {
    // Expo Go veya yerel modül yok: yoksay
  }
}
