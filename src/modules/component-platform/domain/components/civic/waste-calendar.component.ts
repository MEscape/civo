import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const WASTE_CALENDAR_LIMITS = { min: 1, max: 50, initial: 10 } as const;

export const wasteCalendarDefinition = defineComponent({
  type: 'wasteCalendar',
  category: 'civic',
  municipallyEditable: true,
  dataBinding: { kind: 'WasteCollectionEntry' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    district: prop.text(PROP_LIMITS.label, { group: 'content' }),
    limit: prop.number(WASTE_CALENDAR_LIMITS, { group: 'content' }),
  },
});
