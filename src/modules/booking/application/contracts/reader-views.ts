import type { GetBooking } from '../queries/get-booking';
import type { GetBookingCalendar } from '../queries/get-booking-calendar';
import type { GetBookingNames } from '../queries/get-booking-names';
import type { GetBookingSetup } from '../queries/get-booking-setup';
import type { GetEmployeeDayPlan } from '../queries/get-employee-day-plan';
import type { GetEmployeePreferences } from '../queries/get-employee-preferences';
import type { GetLocation } from '../queries/get-location';
import type { GetOpenBookings } from '../queries/get-open-bookings';
import type { GetOwnProfile } from '../queries/get-own-profile';
import type { GetResource } from '../queries/get-resource';
import type { GetService } from '../queries/get-service';
import type { GetServiceFormOptions } from '../queries/get-service-form-options';
import type { GetTeam } from '../queries/get-team';
import type { GetTeamMember } from '../queries/get-team-member';
import type { ListAdoptableServices } from '../queries/list-adoptable-services';
import type { ListBookings } from '../queries/list-bookings';
import type { ListLocations } from '../queries/list-locations';
import type { ListMessages } from '../queries/list-messages';
import type { ListOfferableServices } from '../queries/list-offerable-services';
import type { ListResources } from '../queries/list-resources';
import type { ListServices } from '../queries/list-services';
import type { ListWorkspaces } from '../queries/list-workspaces';

/** The queries the administration screens read with, as their loaders see them: the use cases, never the composition root. */
export interface BookingReaders {
  readonly listWorkspaces: Pick<ListWorkspaces, 'execute'>;
  readonly listLocations: Pick<ListLocations, 'execute'>;
  readonly getBookingSetup: Pick<GetBookingSetup, 'execute'>;
  readonly getLocation: Pick<GetLocation, 'execute'>;
  readonly listServices: Pick<ListServices, 'execute'>;
  readonly getService: Pick<GetService, 'execute'>;
  readonly getServiceFormOptions: Pick<GetServiceFormOptions, 'execute'>;
  readonly listAdoptableServices: Pick<ListAdoptableServices, 'execute'>;
  readonly listOfferableServices: Pick<ListOfferableServices, 'execute'>;
  readonly listResources: Pick<ListResources, 'execute'>;
  readonly getResource: Pick<GetResource, 'execute'>;
  readonly getTeam: Pick<GetTeam, 'execute'>;
  readonly getTeamMember: Pick<GetTeamMember, 'execute'>;
  readonly getOwnProfile: Pick<GetOwnProfile, 'execute'>;
  readonly getBookingNames: Pick<GetBookingNames, 'execute'>;
  readonly listBookings: Pick<ListBookings, 'execute'>;
  readonly getBooking: Pick<GetBooking, 'execute'>;
  readonly getBookingCalendar: Pick<GetBookingCalendar, 'execute'>;
  readonly getEmployeeDayPlan: Pick<GetEmployeeDayPlan, 'execute'>;
  readonly getOpenBookings: Pick<GetOpenBookings, 'execute'>;
  readonly listMessages: Pick<ListMessages, 'execute'>;
  readonly getEmployeePreferences: Pick<GetEmployeePreferences, 'execute'>;
}
