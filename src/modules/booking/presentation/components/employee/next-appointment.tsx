import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { cn } from '@lib/utils';

import { createZonedFormat } from '../../hooks/use-zoned-format';
import { bookingRoutes } from '../../routes';

import type { DayPlanItemDto } from '../../dto/employee-dto';

export interface NextAppointmentProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly item: DayPlanItemDto;
  /** As the server counted them from its clock. */
  readonly minutesUntil: number;
  readonly className?: string;
}

/** The next appointment of today, how soon it starts, what to check, and the way to its details. */
export async function NextAppointment({
  locale,
  websiteId,
  item,
  minutesUntil,
  className,
}: NextAppointmentProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const format = createZonedFormat(locale);
  const { booking, labels, requiredDocuments } = item;
  const place = [labels.locationName, ...labels.resourceNames].filter(Boolean).join(' · ');

  return (
    <section
      aria-labelledby="next-appointment"
      className={cn(
        // Mockup 06 (phone): a bar on the leading edge; mockup 01: the whole card framed in the accent.
        'flex flex-wrap items-center justify-between gap-4 rounded-token border border-border border-s-4 border-s-primary bg-surface p-4 sm:border-2 sm:border-primary',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="flex items-center gap-2 text-sm font-medium text-primary-copy">
          <span aria-hidden="true" className="size-2 rounded-full bg-primary" />
          {t('employee.start.next', { minutes: minutesUntil })}
        </p>
        <h2 id="next-appointment" className="font-heading text-xl font-semibold text-copy">
          {labels.serviceName ?? t('employee.unnamedService')}
        </h2>
        <p className="text-sm text-copy-muted">
          {[format.timeRange(booking.start, booking.end, booking.timeZone), place]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {requiredDocuments.length > 0 && (
          <p className="text-sm text-copy">
            {t('employee.start.check', { documents: requiredDocuments.join(', ') })}
          </p>
        )}
      </div>
      <Link
        href={`${bookingRoutes.mePlan(websiteId)}#booking-${booking.id}`}
        className={cn(buttonVariants({ size: 'lg' }), 'w-full sm:w-auto')}
      >
        {t('employee.start.open')}
      </Link>
    </section>
  );
}
