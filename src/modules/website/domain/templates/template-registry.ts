import { associationTemplate } from './association-template';
import { municipalTemplate } from './municipal-template';
import { smartCityTemplate } from './smart-city-template';

import type { TemplateKey, WebsiteTemplate } from '../models/website-template';

/** `satisfies Record<TemplateKey, ...>`: adding a key without a template does not compile. */
const TEMPLATES = {
  municipal: municipalTemplate,
  'smart-city': smartCityTemplate,
  association: associationTemplate,
} as const satisfies Record<TemplateKey, WebsiteTemplate>;

/** Total on purpose: an unknown key is rejected earlier, at `createWebsiteDraft`. */
export function getTemplate(key: TemplateKey): WebsiteTemplate {
  return TEMPLATES[key];
}
