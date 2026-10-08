'use client';

import { useId } from 'react';

import { useController } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { Card, CardContent } from '@components/ui/card';

import { useTranslations } from '@i18n/client';

import { TEMPLATE_KEYS } from '../../application/contracts/website-constraints';
import { TEMPLATE_MESSAGE_KEYS, MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import type { NewWebsite } from '../schemas/new-website-schema';
import type { Control } from 'react-hook-form';

export interface TemplatePickerProps {
  readonly control: Control<NewWebsite>;
}

/**
 * A radio group, not a row of buttons: one choice from a set is what
 * assistive technology should announce, and arrow keys move the choice.
 */
export function TemplatePicker({ control }: TemplatePickerProps) {
  const t = useTranslations('website');

  const errorId = useId();
  const { field, fieldState } = useController({ control, name: 'templateKey' });
  const errorCode = fieldState.error?.message;

  return (
    <fieldset aria-describedby={errorCode ? errorId : undefined} className="space-y-1.5">
      <legend className="text-sm font-medium text-copy">{t('createForm.template')}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TEMPLATE_KEYS.map((key, index) => {
          const inputId = `${errorId}-${key}`;
          return (
            <label key={key} htmlFor={inputId} className="block cursor-pointer">
              <span className="sr-only">{t(TEMPLATE_MESSAGE_KEYS[key].label)}</span>
              <input
                id={inputId}
                type="radio"
                className="peer sr-only"
                name={field.name}
                value={key}
                checked={field.value === key}
                onChange={() => {
                  field.onChange(key);
                }}
                onBlur={field.onBlur}
                ref={index === 0 ? field.ref : undefined}
              />
              <Card className="h-full ring-accent peer-checked:ring-2">
                <CardContent className="pt-4">
                  <p className="text-sm font-medium text-copy">
                    {t(TEMPLATE_MESSAGE_KEYS[key].label)}
                  </p>
                  <p className="mt-1 text-xs text-copy-muted">
                    {t(TEMPLATE_MESSAGE_KEYS[key].description)}
                  </p>
                </CardContent>
              </Card>
            </label>
          );
        })}
      </div>
      <FieldMessage
        id={errorId}
        message={errorCode ? t(messageKeyForCode(errorCode), MESSAGE_PARAMS) : undefined}
      />
    </fieldset>
  );
}
