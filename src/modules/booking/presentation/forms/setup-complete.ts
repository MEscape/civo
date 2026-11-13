import type { BookingSetupView } from '../../application/contracts/service-views';

/**
 * Whether the booking setup is finished: a location, services, resources and a team (an employee with a
 * calendar). The one answer the booking guide, the website's overview tile and the website's first-steps
 * list all ask, so none of them calls it done while another still asks for a step.
 */
export function isBookingSetupComplete(
  setup: Pick<BookingSetupView, 'locations' | 'services' | 'resources' | 'team'>,
): boolean {
  return setup.locations > 0 && setup.services > 0 && setup.resources > 0 && setup.team > 0;
}
