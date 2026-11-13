'use client';

import { useWatch } from 'react-hook-form';

import { TextField } from '@components/shared/field';
import { Alert } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import type { NewPageStep } from '../../forms/new-page-steps';
import type { useCreatePageForm } from '../../hooks/use-create-page-form';

interface CreatePageFormFieldsProps {
  readonly id: string;
  readonly step: NewPageStep;
  readonly screen: ReturnType<typeof useCreatePageForm>;
}

/** The fields of one wizard step; the review step summarises the page that will be created. */
export function CreatePageFormFields({ id, step, screen }: CreatePageFormFieldsProps) {
  const t = useTranslations('builder');
  const values = useWatch({ control: screen.form.control });

  if (step === 'page') {
    return (
      <>
        <TextField
          id={`${id}-title`}
          label={t('pages.createForm.title')}
          placeholder={t('pages.createForm.titlePlaceholder')}
          autoComplete="off"
          error={screen.errorText(screen.errors.title?.message)}
          {...screen.form.register('title', { onChange: screen.handleTitleChange })}
        />
        <TextField
          id={`${id}-path`}
          label={t('pages.createForm.path')}
          placeholder={t('pages.createForm.pathPlaceholder')}
          hint={t('pages.createForm.pathHint')}
          autoComplete="off"
          error={screen.errorText(screen.errors.path?.message)}
          {...screen.form.register('path', { onBlur: screen.handlePathBlur })}
        />
      </>
    );
  }
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-copy-muted">{t('pages.createForm.title')}</dt>
          <dd className="font-medium text-copy [overflow-wrap:anywhere]">{values.title}</dd>
        </div>
        <div>
          <dt className="text-xs text-copy-muted">{t('pages.createForm.path')}</dt>
          <dd className="font-mono text-sm text-copy [overflow-wrap:anywhere]">/{values.path}</dd>
        </div>
      </dl>
      <Alert variant="info">{t('pages.createForm.afterCreate')}</Alert>
    </div>
  );
}
