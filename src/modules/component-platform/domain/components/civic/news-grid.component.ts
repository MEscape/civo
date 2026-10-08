import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const NEWS_GRID_LIMITS = { min: 1, max: 24, initial: 6 } as const;
const INITIAL_COLUMNS = 3;

export const newsGridDefinition = defineComponent({
  type: 'newsGrid',
  category: 'civic',
  municipallyEditable: true,
  dataBinding: { kind: 'NewsItem' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    limit: prop.number(NEWS_GRID_LIMITS, { group: 'content', municipal: true }),
    category: prop.text(PROP_LIMITS.category, {
      group: 'content',
      municipal: true,
      placeholder: true,
    }),
    columns: prop.columns(INITIAL_COLUMNS, { group: 'appearance' }),
  },
});
