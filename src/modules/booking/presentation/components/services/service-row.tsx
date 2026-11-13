import { ArrowRight, Check, Circle } from '@components/icons/icons';
import type { ResponsiveColumn } from '@components/shared/responsive-table';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { originMessage } from '../../forms/service-labels';
import { serviceListNavigation } from '../../forms/service-list-navigation';
import { bookingRoutes } from '../../routes';
import { StatusChip } from '../shared/status-chip';

import { ServiceOriginChip } from './service-origin-chip';

import type { ServiceSummaryDto } from '../../dto/service-dto';
import type { BookingTranslator } from '../../translation/translator';

/** The columns of a service row and of the header above the rows, so they line up. */
interface ServiceColumnsInput {
  readonly t: BookingTranslator;
  readonly websiteId: string;
  readonly locationId: string;
  readonly listOrigin?: string | undefined;
}

/**
 * One service of a category: its name (the way to its overview), how long it takes, where it came
 * from and whether it runs. A row of a grid on a wide screen and a small card on a narrow one, so
 * nothing scrolls sideways.
 */
export function serviceColumns({
  t,
  websiteId,
  locationId,
  listOrigin,
}: ServiceColumnsInput): Array<ResponsiveColumn<ServiceSummaryDto>> {
  const href = (service: ServiceSummaryDto) =>
    serviceListNavigation.withOrigin(
      bookingRoutes.service(websiteId, locationId, service.id),
      listOrigin,
    );
  return [
    {
      id: 'name',
      label: t('services.list.columns.service'),
      cell: (service) => (
        <Link
          href={href(service)}
          className="font-semibold text-copy underline-offset-4 hover:underline focus-visible:underline"
        >
          {service.name}
        </Link>
      ),
    },
    {
      id: 'duration',
      label: t('services.list.columns.duration'),
      width: '@3xl:w-24',
      cell: (service) => (
        <span className="text-copy-muted">
          {t('services.duration', { minutes: service.durationMinutes })}
        </span>
      ),
    },
    {
      id: 'origin',
      label: t('services.list.columns.origin'),
      cell: (service) => {
        const origin = originMessage(service.origin);
        return (
          <ServiceOriginChip kind={service.origin.kind}>
            {t(origin.key, origin.values)}
          </ServiceOriginChip>
        );
      },
    },
    {
      id: 'status',
      label: t('services.list.columns.status'),
      width: '@3xl:w-28',
      cell: (service) =>
        service.isActive ? (
          <StatusChip tone="success" icon={Check}>
            {t('services.status.active')}
          </StatusChip>
        ) : (
          <StatusChip tone="muted" icon={Circle}>
            {t('services.status.inactive')}
          </StatusChip>
        ),
    },
    {
      id: 'actions',
      label: t('resources.list.open'),
      isAction: true,
      width: '@3xl:w-24',
      cell: (service) => (
        <div className="flex justify-end gap-1">
          <Link
            href={href(service)}
            aria-label={t('resources.list.openNamed', { name: service.name })}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            {t('resources.list.open')}
            <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
          </Link>
        </div>
      ),
    },
  ];
}
