import { text } from '../../models/field-schema';
import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const MAX_ITEMS = 30;
const QUESTION_MAX_LENGTH = 300;

export const accordionDefinition = defineComponent({
  type: 'accordion',
  category: 'content',
  municipallyEditable: true,
  props: {
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    items: prop.items(
      {
        question: text({ min: 1, max: QUESTION_MAX_LENGTH }),
        answer: text({ min: 1, max: PROP_LIMITS.longText }),
      },
      MAX_ITEMS,
      { group: 'content', municipal: true, multiline: ['answer'] },
    ),
  },
});
