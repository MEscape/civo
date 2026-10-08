'use client';

import { useId } from 'react';

import { TextField } from '@components/shared/text-field';

import { useTranslations } from '@i18n/client';

import { parseCustomValue } from '../resolutions/resolution-choices';

import { ConflictValues } from './conflict-values';

import type { ResolutionAction } from '../../application/contracts/release-constraints';
import type { FieldConflict } from '../../application/contracts/release-views';
import type { ConflictChoice } from '../resolutions/resolution-choices';

export interface ConflictFieldProps {
  readonly conflict: FieldConflict;
  readonly choice: ConflictChoice | undefined;
  readonly isDisabled: boolean;
  readonly onChoose: (choice: ConflictChoice) => void;
}

interface ChoiceOption {
  readonly action: ResolutionAction;
  readonly label: string;
}

/**
 * One conflict as a radio group, so assistive technology announces "choose
 * one of these" and arrow keys move the choice.
 */
export function ConflictField({ conflict, choice, isDisabled, onChoose }: ConflictFieldProps) {
  const t = useTranslations('release.migration.conflict');
  const id = useId();

  const isRemoved = conflict.kind === 'removed_upstream';
  const customText = choice?.action === 'custom' ? choice.text : '';

  const options: readonly ChoiceOption[] = [
    { action: 'keep_local', label: t(isRemoved ? 'keepRemoved' : 'keepLocal') },
    { action: 'use_new', label: t(isRemoved ? 'discardRemoved' : 'useNew') },
    // A dropped field is not read by the new version, so a new value for it means nothing.
    ...(isRemoved ? [] : [{ action: 'custom' as const, label: t('custom') }]),
  ];

  function handleChoose(action: ResolutionAction) {
    if (action === 'custom') {
      onChoose({ action: 'custom', text: customText });
      return;
    }
    onChoose({ action });
  }

  return (
    <fieldset className="space-y-3 rounded-token border border-border p-3" disabled={isDisabled}>
      <legend className="px-1 text-sm font-medium text-copy">
        {t('legend', { field: conflict.key })}
      </legend>
      <p className="text-xs text-copy-muted">{t(isRemoved ? 'removedHint' : 'bothChangedHint')}</p>

      <ConflictValues conflict={conflict} />

      <div className="space-y-2">
        {options.map(({ action, label }) => (
          <label key={action} className="flex cursor-pointer items-center gap-2 text-sm text-copy">
            <input
              type="radio"
              className="size-4 accent-primary"
              name={id}
              value={action}
              checked={choice?.action === action}
              onChange={() => {
                handleChoose(action);
              }}
            />
            {label}
          </label>
        ))}
      </div>

      {choice?.action === 'custom' && (
        <TextField
          id={`${id}-custom`}
          label={t('customLabel')}
          hint={t('customHint')}
          value={customText}
          error={parseCustomValue(customText).isValid ? undefined : t('customInvalid')}
          onChange={(event) => {
            onChoose({ action: 'custom', text: event.target.value });
          }}
        />
      )}
    </fieldset>
  );
}
