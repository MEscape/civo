import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const SPLIT_LIMITS = { min: 1, max: 12, initial: 4 } as const;

/**
 * Reads two kinds, so it has no single data binding: each dataset prop names
 * its own, and the release check pins both contracts.
 */
export const newsAndEventsSplitDefinition = defineComponent({
  type: 'newsAndEventsSplit',
  category: 'civic',
  municipallyEditable: true,
  props: {
    newsDatasetId: prop.dataset('NewsItem'),
    eventsDatasetId: prop.dataset('Event'),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    newsLimit: prop.number(SPLIT_LIMITS, { group: 'content', municipal: true }),
    eventsLimit: prop.number(SPLIT_LIMITS, {
      group: 'content',
      municipal: true,
    }),
  },
});
