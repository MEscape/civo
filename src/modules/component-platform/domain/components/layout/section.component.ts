import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';

const SECTION_TONES = ['default', 'muted'] as const;

export const sectionDefinition = defineComponent({
  type: 'section',
  version: 2,
  category: 'layout',
  canHaveChildren: true,
  props: {
    tone: prop.select(SECTION_TONES, 'default', { group: 'appearance', municipal: true }),
    layout: prop.select(['stack', 'split', 'aside'], 'stack', {
      group: 'appearance',
      municipal: true,
    }),
    density: prop.select(['default', 'tight', 'airy'], 'default', {
      group: 'appearance',
      municipal: true,
    }),
  },
});
