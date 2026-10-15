import { useId, useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { removeAt, replaceAt } from '@lib/utils';

import { AVAILABILITY_LIMITS } from '../../../application/contracts/booking-constraints';
import { DEFAULT_EXCEPTION } from '../../drafts/availability-plan-form';
import { groupExceptions, withoutGroup } from '../../drafts/holiday-exceptions';
import { useErrorText } from '../../hooks/use-error-text';
import { hasErrorsUnder } from '../shared/form-error-summary';

import { ExceptionGroup } from './exception-group';
import { ExceptionRow } from './exception-row';
import { HolidayImporter } from './holiday-importer';

import type { DayForm, ExceptionForm } from '../../drafts/availability-plan-form';
import type { FormErrors } from '../shared/form-error-summary';

/** How many of the exceptions entered by hand show at first and with each "show more". */
const PAGE_SIZE = 5;

export interface ExceptionsEditorProps {
  readonly exceptions: readonly ExceptionForm[];
  /** The plan's week, which the previews compare exceptions with. */
  readonly weekly: readonly DayForm[];
  readonly disabled: boolean;
  readonly errors: FormErrors;
  /** The path of the plan in the saved form; an exception's problems are at `<path>.exceptions.<n>.<part>`. */
  readonly errorPath: string;
  readonly onChange: (next: ExceptionForm[]) => void;
}

/**
 * The dated exceptions of a plan: closures, one-off changes and extra
 * openings. What was imported as public holidays is kept apart, one line per
 * state and year, from what was entered by hand; the by-hand list shows a few
 * at a time, and an exception with a problem is always in view.
 */
export function ExceptionsEditor({
  exceptions,
  weekly,
  disabled,
  errors,
  errorPath,
  onChange,
}: ExceptionsEditorProps) {
  const t = useTranslations('booking');
  const id = useId();
  const errorText = useErrorText(errors);
  const [firstYear] = useState(() => new Date().getFullYear());
  const [visible, setVisible] = useState(PAGE_SIZE);
  // At most one preview is open: opening another closes it.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const { own, groups } = groupExceptions(exceptions);
  const prefixOf = (index: number) => `${errorPath}.exceptions.${index}`;
  const shown = own.filter(
    (entry, position) => position < visible || hasErrorsUnder(errors, prefixOf(entry.index)),
  );

  function change(next: readonly ExceptionForm[]) {
    setPreviewIndex(null);
    onChange([...next]);
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-medium text-copy">{t('availability.exceptions')}</h4>
        <p className="text-xs text-copy-muted">{t('availability.exceptionsHint')}</p>
      </div>
      {exceptions.length === 0 && (
        <p className="text-sm text-copy-muted">{t('availability.noExceptions')}</p>
      )}
      {groups.length > 0 && (
        <ul className="space-y-2">
          {groups.map((group) => (
            <ExceptionGroup
              key={`${group.region}-${group.year}`}
              idPrefix={`${id}-${group.region}-${group.year}`}
              group={group}
              disabled={disabled}
              onRemoveEntry={(index) => {
                change(removeAt(exceptions, index));
              }}
              onRemoveGroup={() => {
                change(withoutGroup(exceptions, group));
              }}
            />
          ))}
        </ul>
      )}
      {own.length > 0 && (
        <ul className="space-y-3">
          {shown.map(({ exception, index }) => (
            <ExceptionRow
              // Rows have no identity of their own: they are edited and removed by position.
              key={`${id}-${index}`}
              idPrefix={`${id}-${index}`}
              number={index + 1}
              exception={exception}
              weekly={weekly}
              disabled={disabled}
              isPreviewOpen={previewIndex === index}
              hasProblem={hasErrorsUnder(errors, prefixOf(index))}
              problemAt={(part) => errorText(`${prefixOf(index)}.${part}`)}
              onChange={(next) => {
                onChange(replaceAt(exceptions, index, next));
              }}
              onTogglePreview={() => {
                setPreviewIndex((current) => (current === index ? null : index));
              }}
              onRemove={() => {
                change(removeAt(exceptions, index));
              }}
            />
          ))}
        </ul>
      )}
      {own.length > shown.length && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setVisible((current) => current + PAGE_SIZE);
          }}
        >
          {t('exceptions.showMore', { count: own.length - shown.length })}
        </Button>
      )}
      {visible > PAGE_SIZE && own.length <= shown.length && own.length > PAGE_SIZE && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setVisible(PAGE_SIZE);
          }}
        >
          {t('exceptions.showFewer')}
        </Button>
      )}
      <div className="flex flex-wrap gap-2">
        <HolidayImporter
          idPrefix={`${id}-holidays`}
          exceptions={exceptions}
          disabled={disabled}
          firstYear={firstYear}
          onChange={change}
        />
        {exceptions.length < AVAILABILITY_LIMITS.maxExceptions && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              // The new one goes last, and the list opens far enough to show it.
              setVisible(own.length + 1);
              change([...exceptions, DEFAULT_EXCEPTION]);
            }}
          >
            {t('availability.addException')}
          </Button>
        )}
      </div>
    </div>
  );
}
