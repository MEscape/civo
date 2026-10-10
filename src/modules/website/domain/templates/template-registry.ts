import { associationTemplate } from './association-template';
import { citizenServicesTemplate } from './citizen-services-template';
import { municipalTemplate } from './municipal-template';
import { smartCityTemplate } from './smart-city-template';
import { tourismTemplate } from './tourism-template';

import type { TemplateKey, WebsiteTemplate } from '../models/website-template';

/** `satisfies Record<TemplateKey, ...>`: adding a key without a template does not compile. */
const TEMPLATES = {
  municipal: municipalTemplate,
  'smart-city': smartCityTemplate,
  association: associationTemplate,
  'citizen-services': citizenServicesTemplate,
  tourism: tourismTemplate,
} as const satisfies Record<TemplateKey, WebsiteTemplate>;

/** Total on purpose: an unknown key is rejected earlier, at `createWebsiteDraft`. */
export function getTemplate(key: TemplateKey): WebsiteTemplate {
  return TEMPLATES[key];
}
