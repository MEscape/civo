import { defineContent } from './define-content';
import { label, linkTarget, recordId, shortText, title } from './shared-fields';

/**
 * The fields of a citizen service. Exported on its own because a service
 * detail is a service plus what a finder needs, and must not restate it.
 */
export const SERVICE_SHAPE = {
  id: recordId(),
  title: title(),
  description: shortText(),
  href: linkTarget(),
  icon: label(),
} as const;

/** A citizen service with a link to where it is handled. */
export const serviceContent = defineContent({
  shape: SERVICE_SHAPE,
}).withSample(() => [
  {
    id: 'sample-service-1',
    title: 'Wohnsitz anmelden',
    description: 'Anmeldung eines neuen Wohnsitzes.',
    href: '/leistungen/wohnsitz-anmelden',
  },
  {
    id: 'sample-service-2',
    title: 'Personalausweis beantragen',
    description: 'Neuer Ausweis oder Verlängerung.',
    href: '/leistungen/personalausweis',
  },
  {
    id: 'sample-service-3',
    title: 'Sperrmüll anmelden',
    href: '/leistungen/sperrmuell',
  },
]);
