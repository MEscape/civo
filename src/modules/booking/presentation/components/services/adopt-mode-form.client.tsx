'use client';

import { FieldMessage } from '@components/shared/field';
import { RadioCardGroup } from '@components/shared/select-field';
import { Alert, AlertDescription } from '@components/ui/alert';
import { Button, buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { useTranslations } from '@i18n/client';

import { ADOPT_MODES } from '../../../application/contracts/booking-constraints';
import { useAdoptService } from '../../hooks/use-adopt-service';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { bookingRoutes } from '../../routes';

export interface AdoptModeFormProps {
  readonly websiteId: string;
  readonly locationId: string;
  readonly serviceId: string;
  /** The location the service was picked from: where a copy says it came from. */
  readonly sourceLocationId: string;
}

/**
 * The second step of taking a service over: as an independent copy or as a link, each with what it
 * means and an example, and what is carried over. Success is shown only after the server has
 * confirmed it, by arriving at the service that now exists here.
 */
export function AdoptModeForm({
  websiteId,
  locationId,
  serviceId,
  sourceLocationId,
}: AdoptModeFormProps) {
  const t = useTranslations('booking');
  const { mode, setMode, errorCode, isPending, adopt } = useAdoptService({
    websiteId,
    locationId,
    serviceId,
    sourceLocationId,
  });

  return (
    <form
      noValidate
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault();
        adopt();
      }}
      className="space-y-5"
    >
      <RadioCardGroup
        legend={t('services.adopt.modeLegend')}
        name="adopt-mode"
        value={mode}
        disabled={isPending}
        options={ADOPT_MODES.map((value) => ({
          value,
          label: t(`services.adopt.modes.${value}.label`),
          description: `${t(`services.adopt.modes.${value}.description`)} ${t(`services.adopt.modes.${value}.example`)}`,
        }))}
        onValueChange={(value) => {
          setMode(ADOPT_MODES.find((candidate) => candidate === value) ?? 'copy');
        }}
      />
      <Alert variant="info">
        <AlertDescription>{t('services.adopt.carried')}</AlertDescription>
      </Alert>
      {errorCode !== null && (
        <FieldMessage id="adopt-error" message={t(messageKeyForCode(errorCode), MESSAGE_PARAMS)} />
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Link
          href={bookingRoutes.locationServices(websiteId, locationId)}
          className={buttonVariants({ variant: 'outline' })}
        >
          {t('form.actions.cancel')}
        </Link>
        <Button type="submit" disabled={isPending}>
          {mode === 'copy' ? t('services.adopt.submitCopy') : t('services.adopt.submitLink')}
        </Button>
      </div>
    </form>
  );
}
