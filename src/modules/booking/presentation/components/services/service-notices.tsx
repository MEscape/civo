import { Alert, AlertDescription } from '@components/ui/alert';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { ServiceDto } from '../../dto/service-dto';

export interface ServiceNoticesProps {
  readonly locale: Locale;
  readonly service: ServiceDto;
}

/**
 * What a manager should know about a service before changing it, worked out from the data: that a
 * change reaches new bookings only while bookings are ahead, what is shared with other locations and
 * what is local, that the service is off as a whole, and that it reserves nothing. Each is shown only
 * when it is true.
 */
export async function ServiceNotices({ locale, service }: ServiceNoticesProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const isShared = service.sharedWith.length > 0;
  const reservesNothing = service.resources.length === 0 && service.employee === 'none';

  return (
    <>
      {service.futureBookingCount > 0 && (
        <Alert variant="info">
          <AlertDescription>
            {t('services.overview.newBookingsOnly', { count: service.futureBookingCount })}
          </AlertDescription>
        </Alert>
      )}
      {isShared && (
        <Alert variant="info">
          <AlertDescription className="font-medium">
            {t('services.overview.sharedTitle', { count: service.sharedWith.length + 1 })}
          </AlertDescription>
          <AlertDescription className="space-y-1">
            <p>
              {t('services.overview.sharedBody', {
                names: service.sharedWith.map((place) => place.name).join(', '),
              })}
            </p>
            <p>{t('services.overview.localBody')}</p>
          </AlertDescription>
        </Alert>
      )}
      {!service.isServiceActive && (
        <Alert variant="warning">
          <AlertDescription>{t('services.overview.serviceOff')}</AlertDescription>
        </Alert>
      )}
      {reservesNothing && (
        <Alert variant="warning">
          <AlertDescription>{t('services.overview.nothingReserved')}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
