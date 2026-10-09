import { Platform } from 'react-native';

import 'expo-router/entry';

// Android ana ekran widget'ı (Tokluk): görev işleyicisini kaydet.
// Yalnızca Android'de yüklenir; web ve iOS'te paket çalışmaz.
if (Platform.OS === 'android') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { registerWidgetTaskHandler } = require('react-native-android-widget');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { widgetTaskHandler } = require('./src/widgets/widget-task-handler');
    registerWidgetTaskHandler(widgetTaskHandler);
  } catch (e) {
    console.warn('[widget] görev işleyicisi kaydedilemedi', e);
  }
}
