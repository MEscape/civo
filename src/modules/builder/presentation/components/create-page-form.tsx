'use client';

import { useId, useState, useTransition } from 'react';
import type { ChangeEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { FieldMessage } from '@components/shared/field-message';
import { TextField } from '@components/shared/text-field';
import { Button } from '@components/ui/button';

import { useRouter } from '@i18n';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import { BUILDER_ERROR_CODES } from '../../application/contracts/builder-constraints';
import { createPageAction } from '../actions/create-page-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { normalizePagePath } from '../navigation/page-path';
import { builderRoutes } from '../routes';
import { newPageSchema } from '../schemas/new-page-schema';

import type { NewPage } from '../schemas/new-page-schema';
import type { FieldPath } from 'react-hook-form';

/** "Path taken" is reported on the path input, not as a form-level message. */
const CODE_FIELDS: Readonly<Record<string, FieldPath<NewPage>>> = {
  [BUILDER_ERROR_CODES.pagePathTaken]: 'path',
};

export interface CreatePageFormProps {
  readonly websiteId: string;
}

/** Creates an empty page and opens it in the editor. */
export function CreatePageForm({ websiteId }: CreatePageFormProps) {
  const t = useTranslations('builder');

  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const form = useForm<NewPage>({
    resolver: zodResolver(newPageSchema),
    defaultValues: { websiteId, title: '', path: '' },
  });
  const { errors } = form.formState;

  const titleId = `${id}-title`;
  const pathId = `${id}-path`;

  /** Follow the title until the user has typed their own path. */
  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    if (form.getFieldState('path').isDirty) {
      return;
    }
    form.setValue('path', normalizePagePath(event.target.value), {
      shouldValidate: form.formState.isSubmitted,
    });
  }

  /** Normalise on blur, not per keystroke, so typing a hyphen or slash is possible. */
  function handlePathBlur(event: ChangeEvent<HTMLInputElement>) {
    form.setValue('path', normalizePagePath(event.target.value), {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  function handleSubmit(values: NewPage) {
    setFormErrorCode(null);
    startTransition(async () => {
      const result = await createPageAction(values);
      if (result.ok) {
        router.push(builderRoutes.editor(result.data.websiteId, result.data.id));
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
        id={titleId}
        label={t('pages.createForm.title')}
        placeholder={t('pages.createForm.titlePlaceholder')}
        autoComplete="off"
        error={
          errors.title?.message
            ? t(messageKeyForCode(errors.title.message), MESSAGE_PARAMS)
            : undefined
        }
        {...form.register('title', { onChange: handleTitleChange })}
      />

      <TextField
        id={pathId}
        label={t('pages.createForm.path')}
        placeholder={t('pages.createForm.pathPlaceholder')}
        hint={t('pages.createForm.pathHint')}
        autoComplete="off"
        error={
          errors.path?.message
            ? t(messageKeyForCode(errors.path.message), MESSAGE_PARAMS)
            : undefined
        }
        {...form.register('path', { onBlur: handlePathBlur })}
      />

      {formErrorCode !== null && (
        <FieldMessage
          id={`${id}-form-error`}
          message={t(messageKeyForCode(formErrorCode), MESSAGE_PARAMS)}
          className="text-sm"
        />
      )}

      <Button type="submit" disabled={isPending}>
        {isPending ? t('pages.createForm.submitting') : t('pages.createForm.submit')}
      </Button>
    </form>
  );
}
