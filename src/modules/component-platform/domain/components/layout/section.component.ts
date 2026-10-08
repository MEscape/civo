import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';

const SECTION_TONES = ['default', 'muted'] as const;

export const sectionDefinition = defineComponent({
  type: 'section',
  category: 'layout',
  canHaveChildren: true,
  props: {
    tone: prop.select(SECTION_TONES, 'default', { group: 'appearance', municipal: true }),
  },
});
