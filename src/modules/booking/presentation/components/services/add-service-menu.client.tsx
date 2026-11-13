'use client';

import { useTranslations } from '@i18n/client';

import { bookingRoutes } from '../../routes';
import { ActionMenu } from '../shared/action-menu.client';

export interface AddServiceMenuProps {
  readonly websiteId: string;
  readonly locationId: string;
}

/** The ways to add a service at a location behind one button: make a new one, or take one over from another location. */
export function AddServiceMenu({ websiteId, locationId }: AddServiceMenuProps) {
  const t = useTranslations('booking');

  return (
    <ActionMenu
      label={t('services.create')}
      options={[
        {
          href: bookingRoutes.serviceNew(websiteId, locationId),
          title: t('services.menu.create.title'),
          description: t('services.menu.create.description'),
        },
        {
          href: bookingRoutes.serviceAdopt(websiteId, locationId),
          title: t('services.menu.adopt.title'),
          description: t('services.menu.adopt.description'),
        },
      ]}
    />
  );
}
