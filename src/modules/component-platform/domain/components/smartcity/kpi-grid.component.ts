import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

import { smartCityCategoryProp } from './smart-city-category';

const INITIAL_COLUMNS = 3;

export const kpiGridDefinition = defineComponent({
  type: 'kpiGrid',
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
    columns: prop.columns(INITIAL_COLUMNS, { group: 'appearance' }),
  },
});
