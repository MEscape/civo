import { SMART_CITY_CATEGORIES } from '../../content/smart-city-fields';
import { prop } from '../../models/prop-field';

/** Sentinel for "no category filter"; the renderer maps it to `undefined`. */
export const ALL_CATEGORIES = 'all';

/** The category filter every metric component offers. */
export const smartCityCategoryProp = () =>
  prop.select([ALL_CATEGORIES, ...SMART_CITY_CATEGORIES], ALL_CATEGORIES, {
    group: 'content',
    municipal: true,
  });
