'use client';

import { useId } from 'react';

import { ConfirmDialog } from '@components/shared/dialog';
import { SelectField } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { GERMAN_REGIONS } from '../../../application/contracts/booking-constraints';
import { REGION_MESSAGE_KEYS } from '../../messages/message-keys';

import type { GermanRegion } from '../../../application/contracts/booking-constraints';

export interface ExceptionsImportProps {
  readonly open: boolean;
  readonly region: GermanRegion;
  readonly year: number | undefined;
  /** The years holidays can be imported for. */
  readonly years: readonly number[];
  readonly onRegion: (region: GermanRegion) => void;
  readonly onYear: (year: number) => void;
  readonly onApply: () => void;
  readonly onCancel: () => void;
}

/**
 * Adds the public holidays of a state and year as closures, asked in a dialog: the state and the year
 * are the question, and the answer ("12 holidays added") is said in the list's own footer, where the
 * rows appear. Days that are already entered stay as they are.
 */
export function ExceptionsImport({
  open,
  region,
  year,
  years,
  onRegion,
  onYear,
  onApply,
  onCancel,
}: ExceptionsImportProps) {
  const t = useTranslations('booking');
  const idPrefix = useId();

  return (
    <ConfirmDialog
      open={open}
      confirmVariant="default"
      title={t('exceptions.import.title')}
      description={t('exceptions.import.hint')}
      confirmLabel={t('exceptions.import.apply')}
      cancelLabel={t('exceptions.cancel')}
      isConfirmDisabled={year === undefined}
      onConfirm={onApply}
      onCancel={onCancel}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          id={`${idPrefix}-region`}
          label={t('exceptions.import.region')}
          value={region}
          options={GERMAN_REGIONS.map((key) => ({
            value: key,
            label: t(REGION_MESSAGE_KEYS[key]),
          }))}
          onValueChange={(next) => {
            const known = GERMAN_REGIONS.find((key) => key === next);
            if (known !== undefined) {
              onRegion(known);
            }
          }}
        />
        <SelectField
          id={`${idPrefix}-year`}
          label={t('exceptions.import.year')}
          value={year === undefined ? '' : String(year)}
          options={years.map((candidate) => ({
            value: String(candidate),
            label: String(candidate),
          }))}
          onValueChange={(next) => {
            onYear(Number(next));
          }}
        />
      </div>
    </ConfirmDialog>
  );
}
