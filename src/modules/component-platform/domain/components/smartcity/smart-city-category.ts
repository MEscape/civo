import { prop } from '../../models/prop-field';
import { PROP_LIMITS } from '../prop-limits';

/** The category filter every metric component offers. */
export const smartCityCategoryProp = () =>
  prop.category(PROP_LIMITS.category, {
    group: 'content',
    municipal: true,
  });
