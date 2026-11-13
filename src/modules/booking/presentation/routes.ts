/** The parts of a location that can be edited on their own; `all` walks through every one. */
export const LOCATION_SECTIONS = ['basics', 'hours', 'exceptions', 'all'] as const;
export type LocationSection = (typeof LOCATION_SECTIONS)[number];

/** The parts of a service that can be edited on their own; `all` walks through every one. */
export const SERVICE_SECTIONS = ['general', 'timing', 'resources', 'rules', 'all'] as const;
export type ServiceSection = (typeof SERVICE_SECTIONS)[number];

/** The parts of a resource that can be edited on their own; `all` walks through every one. */
export const RESOURCE_SECTIONS = ['basics', 'availability', 'all'] as const;
export type ResourceSection = (typeof RESOURCE_SECTIONS)[number];

/** The address parameter of a link to a booking: the booking section opens "my booking" with this reference. */
export const BOOKING_MANAGE_PARAM = 'manage';
/** The id of the booking section on a published page (`#booking`), the target of those links. */
export const BOOKING_SECTION_ANCHOR = 'booking';

const admin = (websiteId: string) => `/bookings/${websiteId}`;
const servicesOf = (websiteId: string, locationId: string) =>
  `${admin(websiteId)}/locations/${locationId}/services`;
const resourcesOf = (websiteId: string, locationId: string) =>
  `${admin(websiteId)}/locations/${locationId}/resources`;
const teamOf = (websiteId: string, locationId: string) =>
  `${admin(websiteId)}/locations/${locationId}/team`;

/**
 * Admin routes of the module, in one place so actions (cache invalidation) and components
 * (navigation) cannot drift apart. A screen adds its route here when it is built.
 */
export const bookingRoutes = {
  /** Standalone entry point; the actor chooses an authorized booking workspace here. */
  workspaces: () => '/bookings',
  admin,
  /** A published site: the page that holds the booking answers a `manage` link (`src/app`). */
  publicSite: (siteSlug: string) => `/s/${siteSlug}`,
  /** Every booking of the website: list, filters and the side panel. */
  bookingList: (websiteId: string) => `${admin(websiteId)}/list`,
  /** The bookings of a period in a calendar. */
  bookingCalendar: (websiteId: string) => `${admin(websiteId)}/calendar`,
  locations: (websiteId: string) => `${admin(websiteId)}/locations`,
  locationNew: (websiteId: string) => `${admin(websiteId)}/locations/new`,
  /** One location's overview: a row per part, each with its own edit link. */
  location: (websiteId: string, locationId: string) =>
    `${admin(websiteId)}/locations/${locationId}`,
  locationEdit: (websiteId: string, locationId: string, section: LocationSection) =>
    `${admin(websiteId)}/locations/${locationId}/edit?section=${section}`,
  /** Which location to look after the services of. */
  services: (websiteId: string) => `${admin(websiteId)}/services`,
  /** The services of one location, the context every services screen works in. */
  locationServices: servicesOf,
  serviceNew: (websiteId: string, locationId: string) => `${servicesOf(websiteId, locationId)}/new`,
  serviceAdopt: (websiteId: string, locationId: string) =>
    `${servicesOf(websiteId, locationId)}/adopt`,
  /** One service's overview: a row per part, each with its own edit link. */
  service: (websiteId: string, locationId: string, serviceId: string) =>
    `${servicesOf(websiteId, locationId)}/${serviceId}`,
  serviceEdit: (
    websiteId: string,
    service: { readonly locationId: string; readonly serviceId: string },
    section: ServiceSection,
  ) => `${servicesOf(websiteId, service.locationId)}/${service.serviceId}/edit?section=${section}`,
  /** Which location to look after the resources of. */
  resources: (websiteId: string) => `${admin(websiteId)}/resources`,
  /** The rooms, desks and devices of one location. */
  locationResources: resourcesOf,
  resourceNew: (websiteId: string, locationId: string) =>
    `${resourcesOf(websiteId, locationId)}/new`,
  /** Which location to look after the team of. */
  team: (websiteId: string) => `${admin(websiteId)}/team`,
  /** The employees of one location. */
  locationTeam: teamOf,
  /** One employee's calendar, as a manager edits it. */
  teamMember: (websiteId: string, locationId: string, employeeId: string) =>
    `${teamOf(websiteId, locationId)}/${employeeId}`,
  /** The employee's own area (mockups 01–06): start, open bookings, day plan, preferences, messages. */
  me: (websiteId: string) => `${admin(websiteId)}/me`,
  meOpen: (websiteId: string) => `${admin(websiteId)}/me/open`,
  /** One day of the plan, `YYYY-MM-DD`; without a day, today. */
  mePlan: (websiteId: string, date?: string) =>
    `${admin(websiteId)}/me/plan${date === undefined ? '' : `?date=${date}`}`,
  mePreferences: (websiteId: string) => `${admin(websiteId)}/me/preferences`,
  meMessages: (websiteId: string) => `${admin(websiteId)}/me/messages`,
  /** The signed-in employee's own calendar. */
  ownProfile: (websiteId: string) => `${admin(websiteId)}/me/profile`,
  /** One resource's overview: a row per part, each with its own edit link. */
  resource: (websiteId: string, locationId: string, resourceId: string) =>
    `${resourcesOf(websiteId, locationId)}/${resourceId}`,
  resourceEdit: (
    websiteId: string,
    resource: { readonly locationId: string; readonly resourceId: string },
    section: ResourceSection,
  ) =>
    `${resourcesOf(websiteId, resource.locationId)}/${resource.resourceId}/edit?section=${section}`,
} as const;
