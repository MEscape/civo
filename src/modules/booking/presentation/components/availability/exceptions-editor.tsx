import { useId } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { removeAt, replaceAt } from '@lib/utils';

import { AVAILABILITY_LIMITS } from '../../../application/contracts/booking-constraints';
import { DEFAULT_EXCEPTION } from '../../drafts/availability-plan-form';

import { ExceptionRow } from './exception-row';

import type { ExceptionForm } from '../../drafts/availability-plan-form';

export interface ExceptionsEditorProps {
  readonly exceptions: readonly ExceptionForm[];
  readonly disabled: boolean;
  readonly onChange: (next: ExceptionForm[]) => void;
}

/** The dated exceptions of a plan: closures, one-off changes and extra openings. */
export function ExceptionsEditor({ exceptions, disabled, onChange }: ExceptionsEditorProps) {
  const t = useTranslations('booking');
  const id = useId();

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-copy">{t('availability.exceptions')}</h4>
        <p className="text-xs text-copy-muted">{t('availability.exceptionsHint')}</p>
      </div>
      {exceptions.length === 0 && (
        <p className="text-sm text-copy-muted">{t('availability.noExceptions')}</p>
      )}
      <ul className="space-y-3">
        {exceptions.map((exception, index) => (
          <ExceptionRow
            // Rows have no identity of their own: they are edited and removed by position.
            // eslint-disable-next-line react/no-array-index-key -- see above
            key={`${id}-${index}`}
            idPrefix={`${id}-${index}`}
            exception={exception}
            disabled={disabled}
            onChange={(next) => {
              onChange(replaceAt(exceptions, index, next));
            }}
            onRemove={() => {
              onChange(removeAt(exceptions, index));
            }}
          />
        ))}
      </ul>
      {exceptions.length < AVAILABILITY_LIMITS.maxExceptions && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onChange([...exceptions, DEFAULT_EXCEPTION]);
          }}
        >
          {t('availability.addException')}
        </Button>
      )}
    </div>
  );
}
