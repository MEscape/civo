'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import type { SubmitEvent } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useController, useForm, useWatch } from 'react-hook-form';

import { useReportUnsavedChanges } from '@hooks/use-unsaved-changes';

import { useTranslations } from '@i18n/client';

import { applyActionError } from '@lib/actions';

import {
  AUTH_ERROR_CODES,
  AUTH_VALIDATION_CODES,
} from '../../application/contracts/auth-constraints';
import { updateOwnProfileAction } from '../actions/update-own-profile-action';
import { MESSAGE_PARAMS, messageKeyForCode } from '../messages/message-keys';
import { profileSchema } from '../schemas/profile-schema';

import type { ProfileView } from '../../application/contracts/profile-views';
import type { z } from 'zod';

type ProfileValues = z.infer<typeof profileSchema>;

export function useProfileForm(profile: ProfileView) {
  const t = useTranslations('auth');
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: profile.name, removeImage: false, image: undefined },
  });
  const [isPending, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageErrorCode, setImageErrorCode] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const photoButton = useRef<HTMLButtonElement | null>(null);
  const submitting = useRef(false);
  const removeImage = useWatch({ control: form.control, name: 'removeImage' });
  const { field: controlledImage } = useController({ control: form.control, name: 'image' });
  const { field: nameField } = useController({ control: form.control, name: 'name' });
  const selectedImage = useWatch({ control: form.control, name: 'image' });
  useReportUnsavedChanges(form.formState.isDirty);
  useEffect(
    () => () => {
      if (previewUrl !== null) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  const errorText = (code: string | undefined) =>
    code === undefined ? undefined : t(messageKeyForCode(code), MESSAGE_PARAMS);

  function chooseImage(file: File | undefined) {
    setIsSaved(false);
    form.clearErrors('image');
    const isValid = profileSchema.shape.image.safeParse(file).success;
    setImageErrorCode(isValid ? null : AUTH_VALIDATION_CODES.profileImageInvalid);
    form.setValue('image', isValid ? file : undefined, { shouldDirty: true, shouldValidate: true });
    form.setValue('removeImage', false, { shouldDirty: true });
    setPreviewUrl(file !== undefined && isValid ? URL.createObjectURL(file) : null);
  }

  function clearPhotoSelection() {
    chooseImage(undefined);
    if (fileInput.current) {
      fileInput.current.value = '';
    }
  }

  function removePhoto() {
    clearPhotoSelection();
    form.setValue('removeImage', true, { shouldDirty: true });
  }

  function submit(values: ProfileValues) {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    setErrorCode(null);
    setIsSaved(false);
    startTransition(async () => {
      try {
        const data = new FormData();
        data.set('name', values.name);
        data.set('removeImage', String(values.removeImage));
        if (values.image) {
          data.set('image', values.image);
        }
        const result = await updateOwnProfileAction(data);
        if (!result.ok) {
          setErrorCode(applyActionError(result.error, form.setError));
          return;
        }
        form.reset({ name: values.name, removeImage: false, image: undefined });
        if (fileInput.current) {
          fileInput.current.value = '';
        }
        setPreviewUrl(null);
        setIsSaved(true);
      } catch {
        setErrorCode(AUTH_ERROR_CODES.providerFailed);
      } finally {
        submitting.current = false;
      }
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    if (imageErrorCode !== null) {
      event.preventDefault();
      photoButton.current?.focus();
      return;
    }
    return form.handleSubmit(submit)(event);
  }

  const imageField = {
    name: controlledImage.name,
    onBlur: controlledImage.onBlur,
    ref: (node: HTMLInputElement | null) => {
      fileInput.current = node;
    },
  };

  return {
    form,
    isPending,
    isSaved,
    errorText,
    imageField,
    nameField,
    photoButtonRef: (node: HTMLButtonElement | null) => {
      photoButton.current = node;
      controlledImage.ref(node);
    },
    openFilePicker: () => fileInput.current?.click(),
    clearPhotoSelection,
    fileName: selectedImage?.name,
    hasPhotoSelection: selectedImage !== undefined || imageErrorCode !== null,
    imageError: errorText(imageErrorCode ?? form.formState.errors.image?.message),
    chooseImage,
    removePhoto,
    image: removeImage ? null : (previewUrl ?? profile.image),
    formError: errorCode === null ? null : errorText(errorCode),
    handleSubmit,
  };
}
