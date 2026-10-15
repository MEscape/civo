'use client';

import { useState } from 'react';

import { Badge } from '@components/ui/badge';
import { Button } from '@components/ui/button';

import { Link, useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { bookingRoutes } from '../../routes';
import { LocationForm } from '../admin/location-form.client';

import type { LocationSummaryDto } from '../../dto/setup-dto';

export interface SetupOverviewProps {
  readonly websiteId: string;
  readonly locations: readonly LocationSummaryDto[];
  readonly canConfigure: boolean;
}

/**
 * The first screen of the setup: the locations as cards that say how far each
 * one is set up, and the one way to make a new one. A card opens the place's
 * workspace; making a location leads straight into it, so the next thing to
 * do (its hours, then what is offered) is already on screen.
 */
export function SetupOverview({ websiteId, locations, canConfigure }: SetupOverviewProps) {
  const t = useTranslations('booking');
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  if (isCreating) {
    return (
      <div className="space-y-4 rounded-token border border-border bg-surface p-4">
        <h3 className="text-base font-medium text-copy">{t('locations.new')}</h3>
        <LocationForm
          websiteId={websiteId}
          onSaved={(location) => {
            router.push(bookingRoutes.location(websiteId, location.id));
          }}
          onCancel={() => {
            setIsCreating(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-copy">{t('setup.title')}</h2>
          <p className="text-sm text-copy-muted">{t('setup.intro')}</p>
        </div>
        {canConfigure && locations.length > 0 && (
          <Button
            type="button"
            onClick={() => {
              setIsCreating(true);
            }}
          >
            {t('locations.new')}
          </Button>
        )}
      </div>

      {locations.length === 0 ? (
        <div className="space-y-3 rounded-token border border-dashed border-border-strong bg-canvas p-8 text-center">
          <h3 className="text-base font-medium text-copy">{t('setup.empty.title')}</h3>
          <p className="mx-auto max-w-prose text-sm text-copy-muted">
            {t('setup.empty.description')}
          </p>
          {canConfigure && (
            <Button
              type="button"
              onClick={() => {
                setIsCreating(true);
              }}
            >
              {t('setup.empty.action')}
            </Button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {locations.map((location) => (
            <li key={location.id}>
              <Link
                href={bookingRoutes.location(websiteId, location.id)}
                className="group block h-full space-y-3 rounded-token border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div className="space-y-1">
                  <p className="font-heading text-lg font-semibold text-copy group-hover:text-primary-copy">
                    {location.name}
                  </p>
                  <p className="text-sm text-copy-muted">
                    {location.address ?? t('location.virtual')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!location.isOpen && <Badge variant="warning">{t('setup.card.noHours')}</Badge>}
                  {!location.isActive && <Badge variant="muted">{t('form.inactive')}</Badge>}
                  <Badge variant="outline">
                    {t('setup.card.services', { count: location.serviceCount })}
                  </Badge>
                  <Badge variant="outline">
                    {t('setup.card.resources', { count: location.resourceCount })}
                  </Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!canConfigure && <p className="text-xs text-copy-muted">{t('form.readOnly')}</p>}
    </div>
  );
}
