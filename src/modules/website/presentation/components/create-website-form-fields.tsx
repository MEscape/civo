'use client';

import { useWatch } from 'react-hook-form';

import { TextField } from '@components/shared/field';
import { Alert } from '@components/ui/alert';

import { useTranslations } from '@i18n/client';

import { TEMPLATE_MESSAGE_KEYS } from '../messages/message-keys';

import { TemplatePicker } from './template-picker';

import type { NewWebsiteStep } from '../forms/new-website-steps';
import type { useCreateWebsiteForm } from '../hooks/use-create-website-form';

interface CreateWebsiteFormFieldsProps {
  readonly id: string;
  readonly step: NewWebsiteStep;
  readonly screen: ReturnType<typeof useCreateWebsiteForm>;
}

/** The fields of one wizard step; the review step summarises what will be created. */
export function CreateWebsiteFormFields({ id, step, screen }: CreateWebsiteFormFieldsProps) {
  const t = useTranslations('website');
  const values = useWatch({ control: screen.form.control });

  if (step === 'basics') {
    return (
      <>
        <TextField
          id={`${id}-name`}
          label={t('createForm.name')}
          placeholder={t('createForm.namePlaceholder')}
          autoComplete="organization"
          error={screen.errorText(screen.errors.name?.message)}
          {...screen.form.register('name', { onChange: screen.handleNameChange })}
        />
        <TextField
          id={`${id}-slug`}
          label={t('createForm.slug')}
          hint={t('createForm.slugHint')}
          placeholder={t('createForm.slugPlaceholder')}
          autoComplete="off"
          error={screen.errorText(screen.errors.slug?.message)}
          {...screen.form.register('slug', { onBlur: screen.handleSlugBlur })}
        />
      </>
    );
  }
  if (step === 'template') {
    return <TemplatePicker control={screen.form.control} />;
  }
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-xs text-copy-muted">{t('createForm.name')}</dt>
          <dd className="font-medium text-copy [overflow-wrap:anywhere]">{values.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-copy-muted">{t('createForm.slug')}</dt>
          <dd className="font-mono text-sm text-copy [overflow-wrap:anywhere]">/{values.slug}</dd>
        </div>
        <div>
          <dt className="text-xs text-copy-muted">{t('createForm.template')}</dt>
          <dd className="text-sm text-copy">
            {values.templateKey === undefined
              ? null
              : t(TEMPLATE_MESSAGE_KEYS[values.templateKey].label)}
          </dd>
        </div>
      </dl>
      <Alert variant="info">{t('createForm.afterCreate')}</Alert>
    </div>
  );
}
