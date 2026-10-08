import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

export const richTextDefinition = defineComponent({
  type: 'richText',
  category: 'content',
  municipallyEditable: true,
  props: {
    heading: prop.text(PROP_LIMITS.heading, { group: 'content' }),
    body: prop.longText(PROP_LIMITS.longText, {
      group: 'content',
      municipal: true,
    }),
  },
});
