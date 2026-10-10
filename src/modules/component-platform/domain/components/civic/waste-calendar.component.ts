import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const WASTE_CALENDAR_LIMITS = { min: 1, max: 50, initial: 10 } as const;
/** Further datasets next to the primary one: a calendar per district or per waste type. */
const MAX_ADDITIONAL_DATASETS = 8;

export const wasteCalendarDefinition = defineComponent({
  type: 'wasteCalendar',
  category: 'civic',
  municipallyEditable: true,
  dataBinding: { kind: 'WasteCollectionEntry' },
  props: {
    datasetId: prop.dataset(),
    additionalDatasetIds: prop.datasets(MAX_ADDITIONAL_DATASETS),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    district: prop.category(PROP_LIMITS.label, { group: 'content' }),
    limit: prop.number(WASTE_CALENDAR_LIMITS, { group: 'content' }),
  },
});
