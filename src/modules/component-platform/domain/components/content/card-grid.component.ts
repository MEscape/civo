import { optional, text, url } from '../../models/field-schema';
import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const MAX_CARDS = 24;
const CARD_TITLE_MAX_LENGTH = 200;
const INITIAL_COLUMNS = 3;

export const cardGridDefinition = defineComponent({
  type: 'cardGrid',
  category: 'content',
  municipallyEditable: true,
  props: {
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    cards: prop.items(
      {
        title: text({ min: 1, max: CARD_TITLE_MAX_LENGTH }),
        description: optional(text({ max: PROP_LIMITS.text })),
        href: optional(url({ max: PROP_LIMITS.url, allowRelative: true })),
      },
      MAX_CARDS,
      { group: 'content', municipal: true, multiline: ['description'] },
    ),
    columns: prop.columns(INITIAL_COLUMNS, { group: 'appearance' }),
  },
});
