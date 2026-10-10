import type { Ref } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { INFORMATION_FIELD_MESSAGE_KEYS } from '../../messages/message-keys';

import type { InformationField } from '../../../application/contracts/booking-constraints';

export interface DetailsErrorSummaryProps {
  readonly fields: readonly InformationField[];
  readonly errorText: (field: InformationField) => string | undefined;
  readonly fieldId: (field: InformationField) => string;
  /** Focused when a submission fails, so a screen reader announces what went wrong. */
  readonly summaryRef: Ref<HTMLDivElement>;
}

/** The problems of a failed submission in one place; each links to its field. */
export function DetailsErrorSummary({
  fields,
  errorText,
  fieldId,
  summaryRef,
}: DetailsErrorSummaryProps) {
  const t = useTranslations('booking');

  return (
    <div
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
      className="rounded-token border border-danger-border bg-danger-subtle p-4 text-sm text-danger"
    >
      <p className="font-medium">{t('details.errorSummary')}</p>
      <ul className="mt-1 list-disc pl-5">
        {fields.map((field) => (
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
  );
}
