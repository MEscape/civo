import { prop } from '../../models/prop-field';
import { defineComponent } from '../define-component';
import { PROP_LIMITS } from '../prop-limits';

/**
 * Booking and scheduling: visitors book an appointment or a resource, or
 * staff see the operations calendar. The booking module owns services,
 * resources and availability; this component only places its screens on a
 * page and narrows what a visitor can book.
 *
 * `serviceId` and `category` are the only choices an editor makes. The
 * website comes from the render context, never from a prop, so a page cannot
 * be pointed at another municipality's bookings.
 *
 * The option values mirror the booking section's modes; the block maps them,
 * so a mode one side lacks fails to compile instead of drifting.
 */
export const bookingDefinition = defineComponent({
  type: 'booking',
  category: 'civic',
  municipallyEditable: true,
  props: {
    mode: prop.select(['public', 'adminCalendar'], 'public', { group: 'content' }),
    heading: prop.text(PROP_LIMITS.heading, {
      group: 'content',
      municipal: true,
    }),
    serviceId: prop.text(PROP_LIMITS.id, { group: 'content' }),
    category: prop.text(PROP_LIMITS.category, {
      group: 'content',
      municipal: true,
    }),
  },
});
