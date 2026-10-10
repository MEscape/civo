'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { validateDetails } from '../../flow/details-validation';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';

import { DetailField } from './detail-field';
import { DetailsErrorSummary } from './details-error-summary';
import { ServiceGuidance } from './service-guidance';

import type { InformationField } from '../../../application/contracts/booking-constraints';
import type { PublicServiceDto } from '../../dto/catalog-dto';

export interface DetailsStepProps {
  readonly service: PublicServiceDto;
  readonly values: Readonly<Record<string, string>>;
  /** Problems the server found with the last submission, by field name. */
  readonly serverErrors: Readonly<Record<string, string>>;
  readonly onChange: (field: string, value: string) => void;
  readonly onBack: () => void;
  readonly onSubmit: () => void;
}

/**
 * The form adapts to the service: it asks for exactly the fields the service
 * lists, marks the required ones, and shows what to bring and any
 * instructions beside it. Errors are summarised at the top (focused on a
 * failed submit) and repeated at each field.
 */
export function DetailsStep({
  service,
  values,
  serverErrors,
  onChange,
  onBack,
  onSubmit,
}: DetailsStepProps) {
  const t = useTranslations('booking');
  const id = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const [clientErrors, setClientErrors] = useState<Readonly<Record<string, string>>>({});
  const [attempted, setAttempted] = useState(false);

  const errors = attempted ? { ...serverErrors, ...clientErrors } : serverErrors;
  const errorFields = service.information
    .map(({ field }) => field)
    .filter((field) => errors[field] !== undefined);
  const hasServerErrors = Object.keys(serverErrors).length > 0;

  useEffect(() => {
    if (hasServerErrors) {
      summaryRef.current?.focus();
    }
  }, [hasServerErrors]);

  const fieldId = (field: InformationField) => `${id}-${field}`;
  const errorText = (field: InformationField): string | undefined => {
    const code = errors[field];
    return code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);
  };

  function handleSubmit() {
    const found = validateDetails(service, values);
    setClientErrors(found);
    setAttempted(true);
    if (Object.keys(found).length === 0) {
      onSubmit();
      return;
    }
    // Wait for the summary to render, then move focus to it.
    window.setTimeout(() => {
      summaryRef.current?.focus();
    }, 0);
  }

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <ServiceGuidance service={service} />

      {errorFields.length > 0 && (
        <DetailsErrorSummary
          fields={errorFields}
          errorText={errorText}
          fieldId={fieldId}
          summaryRef={summaryRef}
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {service.information.map(({ field, isRequired }) => (
          <DetailField
            key={field}
            id={fieldId(field)}
            field={field}
            isRequired={isRequired}
            value={values[field] ?? ''}
            error={errorText(field)}
            onChange={(value) => {
              onChange(field, value);
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          {t('actions.back')}
        </Button>
        <Button type="submit">{t('actions.review')}</Button>
      </div>
    </form>
  );
}
