'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { FieldMessage } from '@components/shared/field-message';
import { Button } from '@components/ui/button';
import { Input, Label, Textarea } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import {
  MESSAGE_PARAMS,
  messageKeyForCode,
  INFORMATION_FIELD_MESSAGE_KEYS,
} from '../../messages/message-keys';

import { validateDetails } from './details-validation';

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

interface FieldTraits {
  readonly type: 'text' | 'email' | 'tel';
  readonly autoComplete: string;
  readonly inputMode?: 'email' | 'tel';
}

const TRAITS: Readonly<Record<Exclude<InformationField, 'notes'>, FieldTraits>> = {
  firstName: { type: 'text', autoComplete: 'given-name' },
  lastName: { type: 'text', autoComplete: 'family-name' },
  email: { type: 'email', autoComplete: 'email', inputMode: 'email' },
  phone: { type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
  referenceNumber: { type: 'text', autoComplete: 'off' },
};

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

  function fieldId(field: string) {
    return `${id}-${field}`;
  }

  function errorText(field: string): string | undefined {
    const code = errors[field];
    return code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);
  }

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
      {service.instructions !== null && (
        <aside className="rounded-token border border-info-border bg-info-subtle p-4 text-sm text-info">
          <p className="font-medium">{t('details.instructions')}</p>
          <p className="mt-1 whitespace-pre-line">{service.instructions}</p>
        </aside>
      )}

      {service.requiredDocuments.length > 0 && (
        <section aria-labelledby={`${id}-documents`} className="space-y-2">
          <h4 id={`${id}-documents`} className="text-sm font-medium text-copy">
            {t('details.documents')}
          </h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-copy">
            {service.requiredDocuments.map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ul>
        </section>
      )}

      {errorFields.length > 0 && (
        <div
          ref={summaryRef}
          role="alert"
          tabIndex={-1}
          className="rounded-token border border-danger-border bg-danger-subtle p-4 text-sm text-danger"
        >
          <p className="font-medium">{t('details.errorSummary')}</p>
          <ul className="mt-1 list-disc pl-5">
            {errorFields.map((field) => (
              <li key={field}>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto p-0 text-inherit"
                  onClick={() => {
                    document.getElementById(fieldId(field))?.focus();
                  }}
                >
                  {t(INFORMATION_FIELD_MESSAGE_KEYS[field])}
                </Button>
                {': '}
                {errorText(field)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {service.information.map(({ field, isRequired }) => {
          const error = errorText(field);
          const label = t(INFORMATION_FIELD_MESSAGE_KEYS[field]);
          const requiredMark = isRequired ? t('details.required') : t('details.optional');
          if (field === 'notes') {
            return (
              <div key={field} className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={fieldId(field)}>
                  {label} <span className="text-copy-muted">({requiredMark})</span>
                </Label>
                <Textarea
                  id={fieldId(field)}
                  value={values[field] ?? ''}
                  aria-invalid={error === undefined ? undefined : true}
                  aria-describedby={error === undefined ? undefined : `${fieldId(field)}-error`}
                  aria-required={isRequired}
                  onChange={(event) => {
                    onChange(field, event.target.value);
                  }}
                />
                <FieldMessage id={`${fieldId(field)}-error`} message={error} />
              </div>
            );
          }
          const traits = TRAITS[field];
          return (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={fieldId(field)}>
                {label} <span className="text-copy-muted">({requiredMark})</span>
              </Label>
              <Input
                id={fieldId(field)}
                type={traits.type}
                inputMode={traits.inputMode}
                autoComplete={traits.autoComplete}
                value={values[field] ?? ''}
                aria-invalid={error === undefined ? undefined : true}
                aria-describedby={error === undefined ? undefined : `${fieldId(field)}-error`}
                aria-required={isRequired}
                onChange={(event) => {
                  onChange(field, event.target.value);
                }}
              />
              <FieldMessage id={`${fieldId(field)}-error`} message={error} />
            </div>
          );
        })}
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
