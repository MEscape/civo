import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

export const heroDefinition = defineComponent({
  type: 'hero',
  category: 'content',
  municipallyEditable: true,
  // 2: the image can come from the media library (`image`); `imageUrl` stays as the fallback.
  version: 2,
  props: {
    title: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    subtitle: prop.longText(PROP_LIMITS.text, {
      group: 'content',
      municipal: true,
    }),
    image: prop.media({ group: 'appearance' }),
    // Brand/design decision: municipality admins cannot swap the image.
    imageUrl: prop.url(PROP_LIMITS.url, {
      allowRelative: false,
      group: 'appearance',
      placeholder: true,
    }),
  },
});
