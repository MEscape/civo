'use client';

import { useController } from 'react-hook-form';

import { RadioCardGroup } from '@components/shared/select-field';

import { useTranslations } from '@i18n/client';

import { TEMPLATE_KEYS } from '../../application/contracts/website-constraints';
import { TEMPLATE_MESSAGE_KEYS, MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import type { NewWebsite } from '../schemas/new-website-schema';
import type { Control } from 'react-hook-form';

interface TemplatePickerProps {
  readonly control: Control<NewWebsite>;
}

/**
 * A radio group, not a row of buttons: one choice from a set is what
 * assistive technology should announce, and arrow keys move the choice.
 */
export function TemplatePicker({ control }: TemplatePickerProps) {
  const t = useTranslations('website');
  const { field, fieldState } = useController({ control, name: 'templateKey' });
  const errorCode = fieldState.error?.message;

  return (
    <RadioCardGroup
      legend={t('createForm.template')}
      name={field.name}
      value={field.value}
      options={TEMPLATE_KEYS.map((key) => ({
        value: key,
        label: t(TEMPLATE_MESSAGE_KEYS[key].label),
        description: t(TEMPLATE_MESSAGE_KEYS[key].description),
      }))}
      onValueChange={field.onChange}
      className="sm:grid-cols-3"
      error={errorCode ? t(messageKeyForCode(errorCode), MESSAGE_PARAMS) : undefined}
    />
  );
}
