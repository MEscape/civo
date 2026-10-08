import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const INITIAL_COLUMNS = 3;

export const serviceGridDefinition = defineComponent({
  type: 'serviceGrid',
  category: 'civic',
  municipallyEditable: true,
  dataBinding: { kind: 'Service' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    columns: prop.columns(INITIAL_COLUMNS, { group: 'appearance' }),
  },
});
