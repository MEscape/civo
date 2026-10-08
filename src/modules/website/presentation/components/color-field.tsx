'use client';

import { useId } from 'react';

import { useController } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { Input, Label } from '@components/ui/input';

import { useTranslations } from '@i18n/client';

import { HEX_COLOR_PATTERN } from '../../application/contracts/website-constraints';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';

import type { ThemeSettings } from '../schemas/theme-settings-schema';
import type { Control } from 'react-hook-form';

/** A native colour input needs a valid value; this shows while the hex text is half-typed. */
const NEUTRAL_PICKER_COLOR = '#000000';

export interface ColorFieldProps {
  readonly control: Control<ThemeSettings>;
  readonly name: 'colors.primary' | 'colors.secondary' | 'colors.accent';
  readonly label: string;
}

/** Colour picker plus hex text input bound to one form value. */
export function ColorField({ control, name, label }: ColorFieldProps) {
  const t = useTranslations('website');

  const id = useId();
  const errorId = `${id}-error`;
  const { field, fieldState } = useController({ control, name });
  const errorCode = fieldState.error?.message;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          aria-label={t('themeSettings.colorPicker', { color: label })}
          className="h-9 w-12 cursor-pointer p-1"
          value={HEX_COLOR_PATTERN.test(field.value) ? field.value : NEUTRAL_PICKER_COLOR}
          onChange={field.onChange}
        />
        <Input
          id={id}
          className="flex-1"
          name={field.name}
          ref={field.ref}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          aria-invalid={errorCode ? true : undefined}
          aria-describedby={errorCode ? errorId : undefined}
        />
      </div>
      <FieldMessage
        id={errorId}
        message={errorCode ? t(messageKeyForCode(errorCode), MESSAGE_PARAMS) : undefined}
      />
    </div>
  );
}
