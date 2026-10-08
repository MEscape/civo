import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

import { smartCityCategoryProp } from './smart-city-category';

export const metricChartDefinition = defineComponent({
  type: 'metricChart',
  category: 'smartcity',
  municipallyEditable: true,
  dataBinding: { kind: 'SmartCityMetric' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    category: smartCityCategoryProp(),
  },
});
