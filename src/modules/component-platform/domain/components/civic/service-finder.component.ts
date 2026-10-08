import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

export const serviceFinderDefinition = defineComponent({
  type: 'serviceFinder',
  category: 'civic',
  municipallyEditable: true,
  dataBinding: { kind: 'ServiceDetail' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    description: prop.longText(PROP_LIMITS.text, { group: 'content' }),
    placeholder: prop.text(PROP_LIMITS.label, {
      group: 'content',
      municipal: true,
    }),
    initialCategory: prop.text(PROP_LIMITS.category, {
      group: 'content',
      placeholder: true,
    }),
  },
});
