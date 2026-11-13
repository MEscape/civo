'use client';

import { ConfirmDialog, DialogNotice } from '@components/shared/dialog';
import { RadioCardGroup } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import {
  DEACTIVATION_MODES,
  DEACTIVATION_SCOPES,
  SERVICE_RESOLUTIONS,
} from '../../../application/contracts/booking-constraints';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { ImpactReviewDialog } from '../shared/impact-review-dialog.client';

import type {
  DeactivationMode,
  DeactivationScope,
} from '../../../application/contracts/booking-constraints';
import type { ServiceDto } from '../../dto/service-dto';
import type { useDeactivation } from '../../hooks/use-deactivation';

export interface DeactivateServiceDialogProps {
  readonly service: ServiceDto;
  readonly closing: ReturnType<typeof useDeactivation>;
}

const isMode = (value: string): value is DeactivationMode =>
  DEACTIVATION_MODES.some((mode) => mode === value);
const isScope = (value: string): value is DeactivationScope =>
  DEACTIVATION_SCOPES.some((scope) => scope === value);

/**
 * The two questions of closing a service: how (only stop new bookings, or review the existing ones,
 * and for a shared service also where), then, for a review, what to do with each booking. Both dialogs
 * say plainly that nothing is cancelled automatically and that citizens are told only after the
 * manager has confirmed.
 */
export function DeactivateServiceDialog({ service, closing }: DeactivateServiceDialogProps) {
  const t = useTranslations('booking');
  const zoned = useZonedFormat();
  const isShared = service.sharedWith.length > 0;
  const count =
    closing.scope === 'all' ? service.futureBookingCountAll : service.futureBookingCount;
  const places = new Map([
    [service.location.id, service.location.name],
    ...service.sharedWith.map((place) => [place.id, place.name] as const),
  ]);

  return (
    <>
      <ConfirmDialog
        open={closing.stage === 'choose'}
        size="lg"
        title={t('services.deactivate.title')}
        description={t('services.deactivate.description', { name: service.name, count })}
        confirmLabel={
          closing.mode === 'review'
            ? t('services.deactivate.proceedReview')
            : t('services.deactivate.confirm')
        }
        cancelLabel={t('services.deactivate.cancel')}
        isPending={closing.isPending}
        onConfirm={closing.proceed}
        onCancel={closing.cancel}
      >
        <div className="space-y-4">
          {isShared && (
            <RadioCardGroup
              legend={t('services.deactivate.scopeLegend')}
              name="deactivate-scope"
              value={closing.scope}
              disabled={closing.isPending}
              options={DEACTIVATION_SCOPES.map((value) => ({
                value,
                label: t(`services.deactivate.scopes.${value}.label`),
                description: t(`services.deactivate.scopes.${value}.description`, {
                  count: service.sharedWith.length + 1,
                  names: service.sharedWith.map((place) => place.name).join(', '),
                }),
              }))}
              onValueChange={(value) => {
                if (isScope(value)) {
                  closing.chooseScope(value);
                }
              }}
            />
          )}
          <RadioCardGroup
            legend={t('services.deactivate.modeLegend')}
            name="deactivate-mode"
            value={closing.mode}
            disabled={closing.isPending}
            options={DEACTIVATION_MODES.map((value) => ({
              value,
              label: t(`services.deactivate.modes.${value}.label`),
              description: t(`services.deactivate.modes.${value}.description`),
            }))}
            onValueChange={(value) => {
              if (isMode(value)) {
                closing.chooseMode(value);
              }
            }}
          />
          <DialogNotice tone="warning">{t('services.deactivate.note')}</DialogNotice>
          {closing.errorCode !== null && closing.stage === 'choose' && (
            <DialogNotice tone="danger">
              {t(messageKeyForCode(closing.errorCode), MESSAGE_PARAMS)}
            </DialogNotice>
          )}
        </div>
      </ConfirmDialog>

      <ImpactReviewDialog
        open={closing.stage === 'review'}
        total={closing.impact?.futureBookingCount ?? 0}
        isTruncated={closing.impact?.isTruncated ?? false}
        changes={[t('services.deactivate.reviewChange', { name: service.name })]}
        items={(closing.impact?.bookings ?? []).map((booking) => ({
          id: booking.bookingId,
          label: `${zoned.longDate(booking.start, booking.timeZone)}, ${zoned.timeRange(booking.start, booking.end, booking.timeZone)}`,
          detail: places.get(booking.locationId) ?? '',
        }))}
        choices={SERVICE_RESOLUTIONS.map((value) => ({
          value,
          label: t(`services.deactivate.resolutions.${value}`),
        }))}
        choiceOf={closing.decisions}
        onChoose={closing.choose}
        note={t('services.deactivate.note')}
        confirmLabel={t('services.deactivate.confirm')}
        isPending={closing.isPending}
        onConfirm={closing.confirmReview}
        onCancel={closing.cancel}
      />
    </>
  );
}
