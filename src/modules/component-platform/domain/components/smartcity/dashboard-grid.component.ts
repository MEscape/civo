import { LIST_LIMITS } from '../../content/list-scale';
import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

import { smartCityCategoryProp } from './smart-city-category';

const INITIAL_COLUMNS = 4;

/**
 * KPI tiles, a trend chart and a distribution in one section. Each part reads
 * its own kind, so each has its own dataset prop; the trend and the
 * distribution are optional, and each of the three parts can be switched off.
 *
 * Version 3: the charts read as many records as the Limit allows, which the editor sets.
 *
 * Version 2: the parts became switchable and the tile columns configurable, and
 * the charts now stack by the width of their container (a phone-sized canvas
 * showed them squashed side by side).
 */
export const dashboardGridDefinition = defineComponent({
  type: 'dashboardGrid',
  version: 3,
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
    limit: prop.number(LIST_LIMITS.dataset, { group: 'content', municipal: true }),
    category: smartCityCategoryProp(),
    showKpis: prop.switch(true, { group: 'appearance', municipal: true }),
    showTrend: prop.switch(true, { group: 'appearance', municipal: true }),
    showBreakdown: prop.switch(true, { group: 'appearance', municipal: true }),
    columns: prop.columns(INITIAL_COLUMNS, { group: 'appearance' }),
  },
});
