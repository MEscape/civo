import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

import { smartCityCategoryProp } from './smart-city-category';

export const metricTrendChartDefinition = defineComponent({
  type: 'metricTrendChart',
  category: 'smartcity',
  municipallyEditable: true,
  dataBinding: { kind: 'SmartCityObservation' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    series: prop.text(PROP_LIMITS.label, {
      group: 'content',
      municipal: true,
      placeholder: true,
    }),
    category: smartCityCategoryProp(),
  },
});
