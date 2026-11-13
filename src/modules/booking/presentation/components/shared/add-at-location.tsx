import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { bookingRoutes } from '../../routes';

import { ActionMenu } from './action-menu.client';

import type { SetupLocationView } from '../../../application/contracts/service-views';

export interface AddAtLocationProps {
  readonly websiteId: string;
  /** The locations the website has; without one, the first thing to add is a location. */
  readonly locations: readonly SetupLocationView[];
  /** Where the new thing is made at a location. */
  readonly hrefAt: (locationId: string) => string;
  /** What the button says: "Add service". */
  readonly label: string;
  /** What the way to a location is called in the list: "At {location}". */
  readonly labelAt: (location: string) => string;
  /** What the button says while there is no location yet. */
  readonly labelWithoutLocation: string;
  readonly variant?: 'default' | 'outline';
}

/**
 * The button that adds a service, a resource or a team member without first walking to a location:
 * with one location it goes straight there, with several it asks which, and with none it leads to
 * the first thing missing, a location. Services, resources and the team belong to a location, and
 * this is where that stops being something a first-time manager has to know.
 */
export function AddAtLocation({
  websiteId,
  locations,
  hrefAt,
  label,
  labelAt,
  labelWithoutLocation,
  variant = 'default',
}: AddAtLocationProps) {
  const [only, ...others] = locations;
  if (only === undefined) {
    return (
      <Link href={bookingRoutes.locationNew(websiteId)} className={buttonVariants({ variant })}>
        {labelWithoutLocation}
      </Link>
    );
  }
  if (others.length === 0) {
    return (
      <Link href={hrefAt(only.id)} className={buttonVariants({ variant })}>
        {label}
      </Link>
    );
  }
  return (
    <ActionMenu
      label={label}
      variant={variant}
      options={locations.map((location) => ({
        href: hrefAt(location.id),
        title: labelAt(location.name),
      }))}
    />
  );
}
