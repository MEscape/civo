import { bookingRoutes } from '../routes';

import type { BookingTranslator } from '../translation/translator';

/** The areas the workspace bar offers; the employee's own pages are one each. */
export type WorkspaceArea =
  | 'overview'
  | 'calendar'
  | 'bookings'
  | 'locations'
  | 'services'
  | 'resources'
  | 'team'
  | 'start'
  | 'open'
  | 'plan'
  | 'preferences'
  | 'messages'
  | 'profile';

/** Placeholder a client replaces with the location the person is looking at. */
export const LOCATION_SLOT = ':location';

export interface WorkspaceLink {
  readonly area: WorkspaceArea;
  readonly label: string;
  readonly href: string;
  /** Where the area opens once a location is chosen (services, resources and the team belong to one). */
  readonly locationHref?: string;
  readonly isDisabled?: boolean;
  readonly group?: string;
}

export interface WorkspaceLinksInput {
  readonly t: BookingTranslator;
  readonly websiteId: string;
  /** `booking.read`: the manager's areas. */
  readonly mayManage: boolean;
  readonly mayConfigure: boolean;
  /** `booking.read.own`: the employee's own pages. */
  readonly mayServe: boolean;
  readonly mayClaim: boolean;
  readonly mayProfile: boolean;
  /** The person has a calendar (is on a team): without one a manager has no work of their own to show. */
  readonly hasCalendar: boolean;
  readonly hasLocation: boolean;
  readonly openCount: number;
  readonly unreadCount: number;
}

function managerLinks(input: WorkspaceLinksInput): WorkspaceLink[] {
  const { t, websiteId, hasLocation, mayConfigure } = input;
  const locked = (link: WorkspaceLink): WorkspaceLink =>
    hasLocation ? link : { ...link, isDisabled: true };
  const at = (suffix: string) =>
    `${bookingRoutes.admin(websiteId)}/locations/${LOCATION_SLOT}/${suffix}`;
  return [
    { area: 'overview', label: t('workspace.overview'), href: bookingRoutes.admin(websiteId) },
    locked({
      area: 'calendar',
      label: t('calendar.tab'),
      href: bookingRoutes.bookingCalendar(websiteId),
    }),
    locked({
      area: 'bookings',
      label: t('bookings.tab'),
      href: bookingRoutes.bookingList(websiteId),
    }),
    { area: 'locations', label: t('area.locations'), href: bookingRoutes.locations(websiteId) },
    locked({
      area: 'services',
      label: t('area.services'),
      href: bookingRoutes.services(websiteId),
      locationHref: at('services'),
    }),
    locked({
      area: 'resources',
      label: t('area.resources'),
      href: bookingRoutes.resources(websiteId),
      locationHref: at('resources'),
    }),
    ...(mayConfigure
      ? [
          locked({
            area: 'team',
            label: t('area.team'),
            href: bookingRoutes.team(websiteId),
            locationHref: at('team'),
          }),
        ]
      : []),
  ];
}

function employeeLinks(input: WorkspaceLinksInput, group: string | undefined): WorkspaceLink[] {
  const { t, websiteId, mayClaim, mayProfile, openCount, unreadCount } = input;
  const grouped = group === undefined ? {} : { group };
  return [
    {
      area: 'start',
      label: t('employee.nav.start'),
      href: bookingRoutes.me(websiteId),
      ...grouped,
    },
    ...(mayClaim
      ? [
          {
            area: 'open' as const,
            label:
              openCount > 0
                ? t('employee.nav.open', { count: openCount })
                : t('employee.nav.openPlain'),
            href: bookingRoutes.meOpen(websiteId),
            ...grouped,
          },
        ]
      : []),
    {
      area: 'plan',
      label: t('employee.nav.plan'),
      href: bookingRoutes.mePlan(websiteId),
      ...grouped,
    },
    ...(mayClaim
      ? [
          {
            area: 'preferences' as const,
            label: t('employee.nav.preferences'),
            href: bookingRoutes.mePreferences(websiteId),
            ...grouped,
          },
        ]
      : []),
    {
      area: 'messages',
      label:
        unreadCount > 0
          ? t('employee.nav.messages', { count: unreadCount })
          : t('employee.nav.messagesPlain'),
      href: bookingRoutes.meMessages(websiteId),
      ...grouped,
    },
    ...(mayProfile
      ? [
          {
            area: 'profile' as const,
            label: t('employee.nav.profile'),
            href: bookingRoutes.ownProfile(websiteId),
            ...grouped,
          },
        ]
      : []),
  ];
}

/**
 * The tabs of the workspace bar: a manager's areas (those that need a location are listed but
 * switched off until one exists), and the employee's own pages, as tabs for someone who only serves and
 * as one dropdown for a manager who holds the employee role as well (once they are on a team: all the same pages).
 */
export function workspaceLinks(input: WorkspaceLinksInput): WorkspaceLink[] {
  // The employee's pages are for people who hold the employee role (they can have a calendar, take
  // bookings and keep a profile): all six or none. A role that only reads, an administrator, has none.
  const isEmployee = input.mayServe && input.mayClaim && input.mayProfile;
  if (!input.mayManage) {
    return isEmployee ? employeeLinks(input, undefined) : [];
  }
  return [
    ...managerLinks(input),
    // A manager who is not on a team has no appointments of their own: the dropdown would only hold empty pages.
    ...(isEmployee && input.hasCalendar ? employeeLinks(input, input.t('employee.nav.group')) : []),
  ];
}

/** The areas that belong to one location, by the word that follows the location in the address. */
const OF_LOCATION: Readonly<Record<string, WorkspaceArea>> = {
  services: 'services',
  resources: 'resources',
  team: 'team',
};
/** The areas directly below the workspace, by the first word of the address. */
const TOP_LEVEL: Readonly<Record<string, WorkspaceArea>> = {
  calendar: 'calendar',
  list: 'bookings',
  ...OF_LOCATION,
};
const MINE: Readonly<Record<string, WorkspaceArea>> = {
  open: 'open',
  plan: 'plan',
  preferences: 'preferences',
  messages: 'messages',
  profile: 'profile',
};

function areaOf([first, second, third]: readonly string[]): WorkspaceArea | undefined {
  if (first === undefined) {
    return 'overview';
  }
  if (first === 'me') {
    return MINE[second ?? ''] ?? 'start';
  }
  if (first === 'locations') {
    return OF_LOCATION[third ?? ''] ?? 'locations';
  }
  return TOP_LEVEL[first];
}

/** Where in the workspace an address is: the area its bar tab belongs to, and the location it names. */
export function whereInWorkspace(pathname: string | null): {
  readonly area: WorkspaceArea | undefined;
  readonly locationId: string | undefined;
} {
  const rest = pathname?.split('/bookings/')[1]?.split('/').slice(1);
  if (rest === undefined) {
    return { area: undefined, locationId: undefined };
  }
  const [first, second] = rest;
  return {
    area: areaOf(rest),
    locationId: first === 'locations' && second !== 'new' ? second : undefined,
  };
}
