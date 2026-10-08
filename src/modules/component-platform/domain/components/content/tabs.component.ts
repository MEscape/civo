import { text } from '../../models/field-schema';
import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

const MAX_TABS = 12;

export const tabsDefinition = defineComponent({
  type: 'tabs',
  category: 'content',
  municipallyEditable: true,
  props: {
    tabs: prop.items(
      {
        label: text({ min: 1, max: PROP_LIMITS.label }),
        body: text({ min: 1, max: PROP_LIMITS.longText }),
      },
      MAX_TABS,
      { group: 'content', municipal: true, multiline: ['body'] },
    ),
  },
});
