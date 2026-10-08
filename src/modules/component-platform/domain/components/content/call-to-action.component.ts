import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

export const callToActionDefinition = defineComponent({
  type: 'callToAction',
  category: 'content',
  municipallyEditable: true,
  props: {
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    body: prop.longText(PROP_LIMITS.text, {
      group: 'content',
      municipal: true,
    }),
    buttonLabel: prop.text(PROP_LIMITS.label, {
      group: 'content',
      municipal: true,
    }),
    href: prop.url(PROP_LIMITS.url, {
      allowRelative: true,
      group: 'content',
      municipal: true,
      placeholder: true,
    }),
  },
});
