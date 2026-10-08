import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

import { smartCityCategoryProp } from './smart-city-category';

/**
 * KPI tiles, a trend chart and a distribution in one section. Each part reads
 * its own kind, so each has its own dataset prop; the trend and the
 * distribution are optional.
 */
export const dashboardGridDefinition = defineComponent({
  type: 'dashboardGrid',
  category: 'smartcity',
  municipallyEditable: true,
  props: {
    datasetId: prop.dataset('SmartCityMetric'),
    trendDatasetId: prop.dataset('SmartCityObservation'),
    breakdownDatasetId: prop.dataset('SmartCityBreakdownEntry'),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    category: smartCityCategoryProp(),
  },
});
