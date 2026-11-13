'use client';

import { useWatch } from 'react-hook-form';

import { FieldHint, TextField } from '@components/shared/field';
import { FormSelectField } from '@components/shared/select-field';
import { Alert } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import { AUTH_MODE_MESSAGE_KEYS, PAGINATION_KIND_MESSAGE_KEYS } from '../../messages/message-keys';

import { DataSourceAreaFields } from './data-source-area-fields';
import { DataSourcePaginationFields } from './data-source-pagination-fields';

import type { SourceFormStep } from '../../forms/source-form-steps';
import type { useDataSourceForm } from '../../hooks/use-data-source-form';

interface DataSourceFormFieldsProps {
  readonly id: string;
  readonly step: SourceFormStep;
  readonly screen: ReturnType<typeof useDataSourceForm>;
}

export function DataSourceFormFields({ id, step, screen }: DataSourceFormFieldsProps) {
  const t = useTranslations('dataSources');
  const values = useWatch({ control: screen.form.control });

  if (step === 'connection') {
    return (
      <>
        <TextField
          id={`${id}-name`}
          label={t('sourceForm.name')}
          hint={t('sourceForm.nameHint')}
          placeholder={t('sourceForm.namePlaceholder')}
          error={screen.errorText(screen.errors.name?.message)}
          {...screen.form.register('name')}
        />
        <TextField
          id={`${id}-base-url`}
          type="url"
          inputMode="url"
          autoComplete="off"
          label={t('sourceForm.baseUrl')}
          hint={
            screen.hasHiddenUrlParts
              ? t('sourceForm.baseUrlHiddenHint')
              : t('sourceForm.baseUrlHint')
          }
          placeholder={t('sourceForm.baseUrlPlaceholder')}
          error={screen.errorText(screen.errors.baseUrl?.message)}
          {...screen.form.register('baseUrl')}
        />
        <FormSelectField
          control={screen.form.control}
          name="authMode"
          id={`${id}-auth-mode`}
          label={t('sourceForm.authMode')}
          options={screen.authModeOptions}
          errorText={screen.errorText}
        />
        {values.authMode !== 'NONE' && (
          <Alert variant="info">{t('sourceForm.credentialHint')}</Alert>
        )}
      </>
    );
  }
  if (step === 'records') {
    return (
      <>
        <FieldHint id={`${id}-pagination-hint`} hint={t('sourceForm.steps.records.description')} />
        <DataSourcePaginationFields
          idPrefix={id}
          control={screen.form.control}
          register={screen.form.register}
          errors={screen.errors}
          errorText={screen.errorText}
        />
        <DataSourceAreaFields
          idPrefix={id}
          control={screen.form.control}
          register={screen.form.register}
          setValue={screen.form.setValue}
          errors={screen.errors}
          errorText={screen.errorText}
        />
      </>
    );
  }
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-copy-muted">{t('sourceForm.name')}</dt>
          <dd className="font-medium text-copy [overflow-wrap:anywhere]">{values.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-copy-muted">{t('sourceForm.baseUrl')}</dt>
          <dd className="text-sm text-copy [overflow-wrap:anywhere]">{values.baseUrl}</dd>
        </div>
        <div>
          <dt className="text-xs text-copy-muted">{t('sourceForm.authMode')}</dt>
          <dd className="text-sm text-copy">
            {t(AUTH_MODE_MESSAGE_KEYS[values.authMode ?? 'NONE'])}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-copy-muted">{t('sourceForm.pagination.kind')}</dt>
          <dd className="text-sm text-copy">
            {t(PAGINATION_KIND_MESSAGE_KEYS[values.paginationKind ?? 'none'])}
          </dd>
        </div>
      </dl>
      <Alert variant="info">
        {screen.isEditing ? t('sourceForm.afterEdit') : t('sourceForm.afterSave')}
      </Alert>
    </div>
  );
}
