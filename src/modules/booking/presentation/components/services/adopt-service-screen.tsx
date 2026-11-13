import { Calendar } from '@components/icons/icons';
import { DataPanel, DataPanelBody } from '@components/shared/data-panel';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { isDefined } from '@lib/utils';

import { bookingRoutes } from '../../routes';
import { BookingEmptyState } from '../shared/booking-empty-state';

import { AdoptModeForm } from './adopt-mode-form.client';
import { AdoptServiceList } from './adopt-service-list';

import type { AdoptablePageDto } from '../../dto/service-dto';
import type { AdoptView } from '../../forms/service-list-href';

export interface AdoptServiceScreenProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly page: AdoptablePageDto;
  readonly view: AdoptView;
}

/**
 * Taking a service over from another location, in its two steps side by side, each in the panel
 * every list and form of the module has: pick the service, then say how it is taken (an independent
 * copy or a link). The second step needs the first: until a service is picked from this very list
 * the form is not drawn. With nothing to take over at all there are no steps, only the way on.
 */
export async function AdoptServiceScreen({
  locale,
  websiteId,
  page,
  view,
}: AdoptServiceScreenProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const locationId = page.location.id;
  const base = bookingRoutes.serviceAdopt(websiteId, locationId);
  const picked = page.items.find((service) => service.id === view.service);
  const isUnfiltered = view.search === undefined && view.source === undefined;

  if (page.total === 0 && isUnfiltered) {
    return (
      <BookingEmptyState
        scope="page"
        icon={<Calendar aria-hidden="true" />}
        title={t('services.adopt.emptyTitle')}
        description={t('services.adopt.emptyBody')}
        action={
          <Link href={bookingRoutes.serviceNew(websiteId, locationId)} className={buttonVariants()}>
            {t('services.adopt.createNew')}
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <AdoptServiceList locale={locale} base={base} page={page} view={view} />

      <DataPanel title={t('services.adopt.step2')} className="lg:sticky lg:top-sticky-panel">
        <DataPanelBody>
          {view.service !== undefined && view.from !== undefined ? (
            <>
              {picked !== undefined && (
                <div className="rounded-token border border-border bg-canvas p-3">
                  <p className="text-xs text-copy-muted">{t('services.adopt.picked')}</p>
                  <p className="text-sm font-semibold text-copy">{picked.name}</p>
                  <p className="text-xs text-copy-muted">
                    {[
                      picked.source?.name,
                      t('services.duration', { minutes: picked.durationMinutes }),
                      picked.category,
                    ]
                      .filter(isDefined)
                      .join(' · ')}
                  </p>
                </div>
              )}
              <AdoptModeForm
                key={view.service}
                websiteId={websiteId}
                locationId={locationId}
                serviceId={view.service}
                sourceLocationId={view.from}
              />
            </>
          ) : (
            <BookingEmptyState
              icon={<Calendar aria-hidden="true" />}
              title={t('services.adopt.pickFirstTitle')}
              description={t('services.adopt.pickFirst')}
            />
          )}
        </DataPanelBody>
      </DataPanel>
    </div>
  );
}
