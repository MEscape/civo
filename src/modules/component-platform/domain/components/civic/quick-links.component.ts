import { text, url } from '../../models/field-schema';
import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const MAX_LINKS = 30;

export const quickLinksDefinition = defineComponent({
  type: 'quickLinks',
  category: 'civic',
  municipallyEditable: true,
  props: {
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    links: prop.items(
      {
        label: text({ min: 1, max: PROP_LIMITS.label }),
        href: url({ max: PROP_LIMITS.url, allowRelative: true }),
      },
      MAX_LINKS,
      { group: 'content', municipal: true },
    ),
  },
});
