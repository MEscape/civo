import { Check, Circle } from '@components/icons/icons';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Badge } from '@components/ui/badge';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { toServiceFormValues } from '../../forms/service-form-values';
import { originMessage } from '../../forms/service-labels';
import { serviceListNavigation } from '../../forms/service-list-navigation';
import { SERVICE_PARTS } from '../../forms/service-steps';
import { bookingRoutes } from '../../routes';
import { StatusChip } from '../shared/status-chip';

import { ServiceNotices } from './service-notices';
import { ServiceOriginChip } from './service-origin-chip';
import { ServiceSummaryRows } from './service-summary-rows.client';

import type { ServiceDto } from '../../dto/service-dto';
import type { ServicePartKey } from '../../forms/service-steps';

export interface ServiceOverviewProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly service: ServiceDto;
  /** Whether to offer the edit links: display only, the use case authorizes on its own. */
  readonly mayConfigure: boolean;
  /** Arrived from a save that the server confirmed. */
  readonly isSaved: boolean;
  readonly listOrigin?: string | undefined;
}

/**
 * A service at one location as the four parts it is set up in, each with what is set today worked
 * out from the data and its own way to change it. It says where the service came from and how it is
 * running, and (in `ServiceNotices`) what is shared and what is local. Nothing here is typed in by
 * hand.
 */
export async function ServiceOverview({
  locale,
  websiteId,
  service,
  mayConfigure,
  isSaved,
  listOrigin,
}: ServiceOverviewProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const origin = originMessage(service.origin);
  const hrefs = Object.fromEntries(
    SERVICE_PARTS.map((part) => [
      part,
      serviceListNavigation.withOrigin(
        bookingRoutes.serviceEdit(
          websiteId,
          { locationId: service.location.id, serviceId: service.id },
          part,
        ),
        listOrigin,
      ),
    ]),
  ) as Record<ServicePartKey, string>;

  return (
    <div className="space-y-6">
      {isSaved && (
        <Alert variant="success" role="status">
          <AlertDescription className="font-medium">
            {t('services.overview.savedTitle')}
          </AlertDescription>
          <AlertDescription>{t('services.overview.savedBody')}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <StatusChip
          tone={service.isActive ? 'success' : 'muted'}
          icon={service.isActive ? Check : Circle}
        >
          {service.isActive ? t('services.status.active') : t('services.status.inactive')}
        </StatusChip>
        <StatusChip
          tone={service.isOnlineBookable ? 'success' : 'muted'}
          icon={service.isOnlineBookable ? Check : Circle}
        >
          {service.isOnlineBookable
            ? t('services.status.onlineBookable')
            : t('services.status.notOnlineBookable')}
        </StatusChip>
        <ServiceOriginChip kind={service.origin.kind}>
          {t(origin.key, origin.values)}
        </ServiceOriginChip>
        <Badge variant="muted">
          {t('services.overview.futureBookings', { count: service.futureBookingCount })}
        </Badge>
      </div>

      {mayConfigure && <p className="text-sm text-copy-muted">{t('services.overview.hint')}</p>}

      <ServiceNotices locale={locale} service={service} />

      <ServiceSummaryRows
        label={t('services.overview.sectionsLabel')}
        values={toServiceFormValues(service)}
        resources={service.resources}
        action={mayConfigure ? { hrefs } : undefined}
        isNumbered
      />
    </div>
  );
}
