import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { bookingRoutes } from '../../routes';

import { AddAtLocation } from './add-at-location';

import type { BookingSetupView } from '../../../application/contracts/service-views';
import type { BookingTranslator } from '../../translation/translator';

/**
 * The steps of the setup, in the order the parts depend on each other, each with what it is for, whether
 * it is done and the one action that does it. Services, resources and the team are added at a location,
 * so their actions ask which one (or lead to making the first).
 */
export function setupSteps(t: BookingTranslator, websiteId: string, setup: BookingSetupView) {
  const addAt = (
    key: 'services' | 'resources' | 'team',
    hrefAt: (locationId: string) => string,
  ) => (
    <AddAtLocation
      websiteId={websiteId}
      locations={setup.locationChoices}
      hrefAt={hrefAt}
      label={t(`setup.${key}.action`)}
      labelAt={(location) => t('setup.addAt', { location })}
      labelWithoutLocation={t('setup.locationFirst')}
      variant="outline"
    />
  );

  return [
    {
      id: 'location',
      title: t('setup.location.title'),
      description: t('setup.location.description'),
      isDone: setup.locations > 0,
      action: (
        <Link
          href={bookingRoutes.locationNew(websiteId)}
          className={buttonVariants({ size: 'sm' })}
        >
          {t('setup.location.action')}
        </Link>
      ),
    },
    {
      id: 'services',
      title: t('setup.services.title'),
      description: t('setup.services.description'),
      isDone: setup.services > 0,
      action: addAt('services', (id) => bookingRoutes.serviceNew(websiteId, id)),
    },
    {
      id: 'resources',
      title: t('setup.resources.title'),
      description: t('setup.resources.description'),
      isDone: setup.resources > 0,
      action: addAt('resources', (id) => bookingRoutes.resourceNew(websiteId, id)),
    },
    {
      id: 'team',
      title: t('setup.team.title'),
      description: t('setup.team.description'),
      isDone: setup.team > 0,
      action: addAt('team', (id) => bookingRoutes.locationTeam(websiteId, id)),
    },
  ];
}
