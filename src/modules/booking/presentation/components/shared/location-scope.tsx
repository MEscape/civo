import { MapPin } from '@components/icons/icons';

import { cn } from '@lib/utils';

import { bookingRoutes } from '../../routes';

import { ActionMenu } from './action-menu.client';
import { NameTile } from './name-tile';

import type { LocationArea } from './area-location-picker';

const TRIGGER_TILE = 'size-5 rounded-token-sm text-xs';
const OPTION_TILE = 'size-8 rounded-token-sm text-sm';

/** The page of an area at one location. */
export const AREA_LIST_ROUTES = {
  services: bookingRoutes.locationServices,
  resources: bookingRoutes.locationResources,
  team: bookingRoutes.locationTeam,
} as const;

/** The page of an area above its locations, where one is chosen. */
export const AREA_ENTRY_ROUTES = {
  services: bookingRoutes.services,
  resources: bookingRoutes.resources,
  team: bookingRoutes.team,
} as const;

export interface LocationScopeProps {
  readonly websiteId: string;
  readonly locationId: string;
  readonly area: LocationArea;
  /** Every location the person may work at (`getBookingSetup`); the switch is shown when there are two or more. */
  readonly choices: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  /** "Working at", already translated. */
  readonly label: string;
  /** The last choice, which leads up to where a location is chosen ("All locations"). */
  readonly allLabel: string;
}

/**
 * Says which location a services, resources or team page is about and switches it without leaving
 * the area. Shown only when there is another location to switch to: with one, the heading says it.
 */
export function LocationScope({
  websiteId,
  locationId,
  area,
  choices,
  label,
  allLabel,
}: LocationScopeProps) {
  const current = choices.find(({ id }) => id === locationId);
  if (current === undefined || choices.length < 2) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-copy-muted">
      <span>{label}</span>
      <ActionMenu
        variant="outline"
        size="sm"
        align="start"
        label={current.name}
        leading={<NameTile name={current.name} className={TRIGGER_TILE} />}
        options={[
          ...choices.map(({ id, name }) => ({
            title: name,
            href: AREA_LIST_ROUTES[area](websiteId, id),
            isCurrent: id === locationId,
            leading: <NameTile name={name} className={OPTION_TILE} />,
          })),
          {
            title: allLabel,
            href: AREA_ENTRY_ROUTES[area](websiteId),
            leading: (
              <span
                aria-hidden="true"
                className={cn(
                  'flex shrink-0 items-center justify-center bg-canvas text-copy-muted',
                  OPTION_TILE,
                )}
              >
                <MapPin className="size-4" />
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
