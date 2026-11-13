'use client';

import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useDeactivation } from '../../hooks/use-deactivation';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

import { DeactivateServiceDialog } from './deactivate-service-dialog.client';

import type { ServiceDto } from '../../dto/service-dto';

export interface ServiceStatusActionsProps {
  readonly service: ServiceDto;
  readonly locationId: string;
}

/**
 * Switching the service off or on again from its overview. Off opens the dialog that asks how; on is
 * plain and immediate, at once for this location, and for a service that is off as a whole the
 * button says it opens it everywhere.
 */
export function ServiceStatusActions({ service, locationId }: ServiceStatusActionsProps) {
  const t = useTranslations('booking');
  const closing = useDeactivation({ service, locationId });
  // A service closed as a whole is opened as a whole; one closed here only, here.
  const reopening = service.isServiceActive ? 'location' : 'all';

  return (
    <>
      {service.isActive ? (
        <Button type="button" variant="outline" onClick={closing.open}>
          {t('services.deactivate.trigger')}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          disabled={closing.isPending}
          onClick={() => {
            closing.reactivate(reopening);
          }}
        >
          {t('services.reactivate')}
        </Button>
      )}
      {closing.errorCode !== null && closing.stage === 'closed' && (
        <FieldMessage
          id="service-status-error"
          message={t(messageKeyForCode(closing.errorCode), MESSAGE_PARAMS)}
        />
      )}
      <DeactivateServiceDialog service={service} closing={closing} />
    </>
  );
}
