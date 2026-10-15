import { useState } from 'react';

import { Button } from '@components/ui/button';
import { Icons } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useZonedFormat } from '../../hooks/use-zoned-format';
import { GERMAN_REGION_MESSAGE_KEYS, HOLIDAY_MESSAGE_KEYS } from '../../messages/message-keys';

import type { HolidayGroup } from '../../drafts/holiday-exceptions';

export interface ExceptionGroupProps {
  readonly idPrefix: string;
  readonly group: HolidayGroup;
  readonly disabled: boolean;
  /** Takes out one imported day (by its place in the plan). */
  readonly onRemoveEntry: (index: number) => void;
  readonly onRemoveGroup: () => void;
}

/**
 * The public holidays imported for one state and year, kept together because
 * they belong together: shown as one line, opened to see the days, and removed
 * in one step. Their names are worked out here, in the language of whoever
 * looks, instead of being stored in the language of whoever imported them.
 */
export function ExceptionGroup({
  idPrefix,
  group,
  disabled,
  onRemoveEntry,
  onRemoveGroup,
}: ExceptionGroupProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');
  const [isOpen, setIsOpen] = useState(false);
  const regionName = t(GERMAN_REGION_MESSAGE_KEYS[group.region]);

  return (
    <li className="rounded-token border border-border bg-canvas p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-copy">
            {t('exceptions.groupTitle', { region: regionName, year: group.year })}
          </p>
          <p className="text-xs text-copy-muted">
            {t('exceptions.groupCount', { count: group.entries.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={isOpen}
            aria-controls={`${idPrefix}-days`}
            onClick={() => {
              setIsOpen((current) => !current);
            }}
          >
            {isOpen ? t('exceptions.hideDays') : t('exceptions.showDays')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onRemoveGroup}
          >
            {t('exceptions.removeGroup')}
          </Button>
        </div>
      </div>
      {isOpen && (
        <ul id={`${idPrefix}-days`} className="mt-3 divide-y divide-border text-sm">
          {group.entries.map(({ exception, index }) => {
            const name = exception.holiday ? t(HOLIDAY_MESSAGE_KEYS[exception.holiday.key]) : '';
            return (
              <li key={index} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-copy">{name}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-copy-muted">{format.longDate(exception.from)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="size-7 p-0"
                    disabled={disabled}
                    aria-label={t('exceptions.removeHoliday', { name })}
                    onClick={() => {
                      onRemoveEntry(index);
                    }}
                  >
                    <Icons.close className="size-3.5" aria-hidden="true" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
