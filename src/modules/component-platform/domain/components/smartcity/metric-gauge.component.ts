import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

export const metricGaugeDefinition = defineComponent({
  type: 'metricGauge',
  category: 'smartcity',
  municipallyEditable: true,
  dataBinding: { kind: 'SmartCityGoal' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    goalId: prop.text(PROP_LIMITS.id, {
      group: 'content',
      municipal: true,
      placeholder: true,
    }),
  },
});
