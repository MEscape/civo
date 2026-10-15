import { useState } from 'react';

import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import {
  AVAILABILITY_LIMITS,
  GERMAN_REGIONS,
} from '../../../application/contracts/booking-constraints';
import {
  holidayProposals,
  importSize,
  importedRegionOf,
  withHolidayClosures,
} from '../../drafts/holiday-exceptions';
import { useZonedFormat } from '../../hooks/use-zoned-format';
import { GERMAN_REGION_MESSAGE_KEYS, HOLIDAY_MESSAGE_KEYS } from '../../messages/message-keys';
import { OptionSelectField } from '../shared/option-select-field';

import type { GermanRegion } from '../../../application/contracts/booking-constraints';
import type { ExceptionForm } from '../../drafts/availability-plan-form';
import type { ProposalStatus } from '../../drafts/holiday-exceptions';

export interface HolidayImporterProps {
  readonly idPrefix: string;
  readonly exceptions: readonly ExceptionForm[];
  readonly disabled: boolean;
  /** The calendar year to start from; passed in so the component reads no clock. */
  readonly firstYear: number;
  readonly onChange: (next: ExceptionForm[]) => void;
}

const DEFAULT_REGION: GermanRegion = 'DE';
const YEARS_OFFERED = 3;

const STATUS_MESSAGE_KEYS = {
  new: null,
  replaces: 'holidays.status.replaces',
  covered: 'holidays.status.covered',
} as const satisfies Record<ProposalStatus, string | null>;

function isRegion(value: string): value is GermanRegion {
  return GERMAN_REGIONS.some((region) => region === value);
}

/**
 * Proposes the public holidays of a state and year as closures. Nothing is
 * decided for the editor: they see every day first, and the closures only
 * become part of the opening hours when the location is saved. The holidays
 * imported for that year are replaced, so moving to another state is choosing
 * it and adding; a day somebody entered by hand is never touched, and the
 * holiday on it is not added. The closures remember that they are holidays,
 * which is what lets them be shown, replaced and removed as a group.
 */
export function HolidayImporter({
  idPrefix,
  exceptions,
  disabled,
  firstYear,
  onChange,
}: HolidayImporterProps) {
  const t = useTranslations('booking');
  const format = useZonedFormat('UTC');
  const [isOpen, setIsOpen] = useState(false);
  const [region, setRegion] = useState<GermanRegion>(
    () => importedRegionOf(exceptions) ?? DEFAULT_REGION,
  );
  const [year, setYear] = useState(firstYear);

  if (!isOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          setRegion(importedRegionOf(exceptions) ?? DEFAULT_REGION);
          setIsOpen(true);
        }}
      >
        {t('holidays.open')}
      </Button>
    );
  }

  const proposals = holidayProposals(region, year, exceptions);
  const { count, isOverLimit } = importSize(exceptions, year, proposals);
  const skipped = proposals.filter((proposal) => proposal.status === 'covered').length;

  return (
    <section
      aria-labelledby={`${idPrefix}-title`}
      className="w-full space-y-3 rounded-token border border-border bg-canvas p-3"
    >
      <h5 id={`${idPrefix}-title`} className="text-sm font-medium text-copy">
        {t('holidays.title')}
      </h5>
      <p className="text-xs text-copy-muted">{t('holidays.hint')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <OptionSelectField
            id={`${idPrefix}-region`}
            label={t('holidays.region')}
            value={region}
            options={GERMAN_REGIONS.map((code) => ({
              value: code,
              label: t(GERMAN_REGION_MESSAGE_KEYS[code]),
            }))}
            onValueChange={(next) => {
              if (isRegion(next)) {
                setRegion(next);
              }
            }}
          />
        </div>
        <OptionSelectField
          id={`${idPrefix}-year`}
          label={t('holidays.year')}
          value={String(year)}
          options={Array.from({ length: YEARS_OFFERED }, (_, step) => ({
            value: String(firstYear + step),
            label: String(firstYear + step),
          }))}
          onValueChange={(next) => {
            setYear(Number(next));
          }}
        />
      </div>
      <ul className="space-y-1 text-sm text-copy">
        {proposals.map((proposal) => {
          const statusKey = STATUS_MESSAGE_KEYS[proposal.status];
          return (
            <li
              key={proposal.key}
              className={cn(
                'flex flex-wrap items-baseline justify-between gap-x-3',
                proposal.status === 'covered' && 'text-copy-muted',
              )}
            >
              <span>{t(HOLIDAY_MESSAGE_KEYS[proposal.key])}</span>
              <span className="text-xs text-copy-muted">
                {format.longDate(proposal.date)}
                {statusKey !== null && ` · ${t(statusKey)}`}
              </span>
            </li>
          );
        })}
      </ul>
      {skipped > 0 && (
        <p className="text-xs text-copy-muted">{t('holidays.skipped', { count: skipped })}</p>
      )}
      <p className="text-xs text-copy-muted">{t('holidays.note')}</p>
      {isOverLimit && (
        <p role="alert" className="text-xs text-danger">
          {t('holidays.limit', { max: AVAILABILITY_LIMITS.maxExceptions })}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={disabled || count === 0}
          onClick={() => {
            onChange([...withHolidayClosures(exceptions, { region, year, proposals })]);
            setIsOpen(false);
          }}
        >
          {t('holidays.apply', { count })}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsOpen(false);
          }}
        >
          {t('holidays.close')}
        </Button>
      </div>
    </section>
  );
}
