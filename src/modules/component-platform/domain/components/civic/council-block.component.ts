import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

export const councilBlockDefinition = defineComponent({
  type: 'councilBlock',
  category: 'civic',
  municipallyEditable: true,
  dataBinding: { kind: 'CouncilBody' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
  },
});
