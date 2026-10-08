import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const ALERT_BANNER_LIMITS = { min: 1, max: 10, initial: 3 } as const;

/**
 * "Only active alerts" is no longer a prop: which alerts are relevant is
 * decided once, by the `Alert` contract's `isRelevant` rule.
 */
export const alertBannerDefinition = defineComponent({
  type: 'alertBanner',
  category: 'civic',
  municipallyEditable: true,
  dataBinding: { kind: 'Alert' },
  props: {
    datasetId: prop.dataset(),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    limit: prop.number(ALERT_BANNER_LIMITS, {
      group: 'content',
      municipal: true,
    }),
  },
});
