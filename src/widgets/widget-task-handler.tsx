'use no memo';
import React from 'react';

import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { ToklukWidget } from './ToklukWidget';
import { getToklukWidgetProps } from './tokluk-widget-data';

/**
 * Android ana ekran widget'ının görev işleyicisi: ekleme, otomatik/periyodik güncelleme ve
 * yeniden boyutlandırmada widget'ı güncel veriyle yeniden çizer. Tıklama, widget üzerindeki
 * OPEN_URI eylemiyle yerel olarak çözülür (JS'e gelmez).
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await getToklukWidgetProps();
      props.renderWidget(<ToklukWidget {...data} />);
      break;
    }
    default:
      break;
  }
}
