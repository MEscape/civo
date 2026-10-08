'use client';

import { useId, useState, useTransition } from 'react';
import type { ChangeEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { builderRoutes } from '@modules/builder/client';

import { FieldMessage } from '@components/shared/field-message';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';
import { slugify } from '@lib/utils';

import {
  TEMPLATE_KEYS,
  WEBSITE_ERROR_CODES,
} from '../../application/contracts/website-constraints';
import { createWebsiteAction } from '../actions/create-website-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { newWebsiteSchema } from '../schemas/new-website-schema';

import { TemplatePicker } from './template-picker';

import type { NewWebsite } from '../schemas/new-website-schema';
import type { FieldPath } from 'react-hook-form';

const DEFAULT_TEMPLATE_KEY = TEMPLATE_KEYS[0];

/** "Slug taken" is reported on the slug input, not as a form-level message. */
const CODE_FIELDS: Readonly<Record<string, FieldPath<NewWebsite>>> = {
  [WEBSITE_ERROR_CODES.slugTaken]: 'slug',
};

export function CreateWebsiteForm() {
  const t = useTranslations('website');
  /** A field's error code as text in this module's language; `undefined` while the field is valid. */
  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<NewWebsite>({
    resolver: zodResolver(newWebsiteSchema),
    defaultValues: { name: '', slug: '', templateKey: DEFAULT_TEMPLATE_KEY },
  });
  const { errors } = form.formState;

  const nameId = `${id}-name`;
  const slugId = `${id}-slug`;

  /** Follow the name until the user has typed their own slug. */
  function handleNameChange(event: ChangeEvent<HTMLInputElement>) {
    if (form.getFieldState('slug').isDirty) {
      return;
    }
    form.setValue('slug', slugify(event.target.value), {
      shouldValidate: form.formState.isSubmitted,
    });
  }

  /** Normalise on blur, not per keystroke, so typing a hyphen is possible. */
  function handleSlugBlur(event: ChangeEvent<HTMLInputElement>) {
    form.setValue('slug', slugify(event.target.value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleSubmit(values: NewWebsite) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await createWebsiteAction(values);
      if (result.ok) {
        router.push(builderRoutes.pages(result.data.id));
        return;
      }
      setFormErrorCode(applyActionError(result.error, form.setError, CODE_FIELDS));
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      noValidate
      aria-busy={isPending}
      className="space-y-6"
    >
      <TextField
        id={nameId}
        label={t('createForm.name')}
        placeholder={t('createForm.namePlaceholder')}
        autoComplete="organization"
        error={errorText(errors.name?.message)}
        {...form.register('name', { onChange: handleNameChange })}
      />

      <TextField
        id={slugId}
        label={t('createForm.slug')}
        placeholder={t('createForm.slugPlaceholder')}
        autoComplete="off"
        error={errorText(errors.slug?.message)}
        {...form.register('slug', { onBlur: handleSlugBlur })}
      />

      <TemplatePicker control={form.control} />

      {formErrorCode !== null && (
        <FieldMessage
          id={`${id}-form-error`}
          message={t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)}
          className="text-sm"
        />
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? t('createForm.submitting') : t('createForm.submit')}
      </Button>
    </form>
  );
}
