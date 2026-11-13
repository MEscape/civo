'use client';

import { useWatch } from 'react-hook-form';

import { FieldHint, TextField } from '@components/shared/field';
import { FormSelectField } from '@components/shared/select-field';
import { Alert } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import { CANONICAL_KIND_MESSAGE_KEYS } from '../../messages/message-keys';

import type { DatasetFormStep } from '../../forms/dataset-form-steps';
import type { useDatasetForm } from '../../hooks/use-dataset-form';

interface DatasetFormFieldsProps {
  readonly id: string;
  readonly step: DatasetFormStep;
  readonly isEditing: boolean;
  readonly screen: ReturnType<typeof useDatasetForm>;
}

export function DatasetFormFields({ id, step, isEditing, screen }: DatasetFormFieldsProps) {
  const t = useTranslations('dataSources');
  const values = useWatch({ control: screen.form.control });
  if (step === 'basics') {
    return (
      <>
        <TextField
          id={`${id}-name`}
          label={t('datasetForm.name')}
          placeholder={t('datasetForm.namePlaceholder')}
          error={screen.errorText(screen.errors.name?.message)}
          {...screen.form.register('name')}
        />
        {isEditing ? (
          <div className="space-y-1.5">
            <TextField
              id={`${id}-kind`}
              label={t('datasetForm.kind')}
              value={t(CANONICAL_KIND_MESSAGE_KEYS[values.canonicalKind ?? 'Event'])}
              readOnly
            />
            <FieldHint id={`${id}-kind-hint`} hint={t('datasetForm.kindFixed')} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <FormSelectField
              control={screen.form.control}
              name="canonicalKind"
              id={`${id}-kind`}
              label={t('datasetForm.kind')}
              options={screen.kindOptions}
              errorText={screen.errorText}
            />
            <FieldHint id={`${id}-kind-hint`} hint={t('datasetForm.kindHint')} />
          </div>
        )}
      </>
    );
  }
  if (step === 'endpoint') {
    return (
      <TextField
        id={`${id}-path`}
        label={t('datasetForm.path')}
        hint={t('datasetForm.pathHint')}
        placeholder={t('datasetForm.pathPlaceholder')}
        error={screen.errorText(screen.errors.path?.message)}
        {...screen.form.register('path')}
      />
    );
  }
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-copy-muted">{t('datasetForm.name')}</dt>
          <dd className="font-medium text-copy [overflow-wrap:anywhere]">{values.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-copy-muted">{t('datasetForm.kind')}</dt>
          <dd className="text-sm text-copy">
            {t(CANONICAL_KIND_MESSAGE_KEYS[values.canonicalKind ?? 'Event'])}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-copy-muted">{t('datasetForm.path')}</dt>
          <dd className="text-sm text-copy [overflow-wrap:anywhere]">
            {values.path === '' || values.path === undefined
              ? t('datasetForm.sourcePath')
              : values.path}
          </dd>
        </div>
      </dl>
      {/* After an edit the person returns to the source; only a new dataset goes on to its mapping. */}
      {!isEditing && <Alert variant="info">{t('datasetForm.afterSave')}</Alert>}
    </div>
  );
}
