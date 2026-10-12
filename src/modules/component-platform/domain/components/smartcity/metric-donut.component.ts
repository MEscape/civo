import { LIST_LIMITS } from '../../content/list-scale';
import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

export const metricDonutDefinition = defineComponent({
  type: 'metricDonut',
  version: 1,
  category: 'smartcity',
  municipallyEditable: true,
  dataBinding: { kind: 'SmartCityBreakdownEntry' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    limit: prop.number(LIST_LIMITS.dataset, { group: 'content', municipal: true }),
    group: prop.text(PROP_LIMITS.label, {
      group: 'content',
      municipal: true,
      placeholder: true,
    }),
  },
});
