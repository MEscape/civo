import { LIST_LIMITS } from '../../content/list-scale';
import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

/** Source-defined place statuses; the parking feed has statuses and timestamps, not numeric capacities. */
export const statusBoardDefinition = defineComponent({
  type: 'statusBoard',
  version: 1,
  category: 'smartcity',
  municipallyEditable: true,
  dataBinding: { kind: 'GeoFeature' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, { group: 'content', municipal: true }),
    limit: prop.number(LIST_LIMITS.dataset, { group: 'content', municipal: true }),
  },
});
