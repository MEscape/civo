'use client';

import { useState } from 'react';

import { useMediaUpload } from './use-media-upload';

/**
 * The library's upload: choose files, review them (and whether they stay private), upload them
 * one after the other, and say how it went. Nothing is sent before the person confirms.
 */
export function useMediaLibraryUpload(websiteId: string) {
  const { fileInput, isUploading, problem, upload, clearInput } = useMediaUpload(websiteId);
  const [chosen, setChosen] = useState<readonly File[]>([]);
  const [isPrivate, setIsPrivate] = useState(false);
  const [sending, setSending] = useState(0);
  const [stored, setStored] = useState(0);

  return {
    fileInput,
    chosen,
    isPrivate,
    isUploading,
    sending,
    stored,
    problem,
    openPicker: () => fileInput.current?.click(),
    choose: (files: readonly File[]) => {
      setStored(0);
      setChosen(files);
    },
    setIsPrivate,
    cancel: () => {
      setChosen([]);
      clearInput();
    },
    confirm: () => {
      setChosen([]);
      setSending(chosen.length);
      setStored(0);
      void upload(chosen, isPrivate ? 'private' : 'public').then((files) => {
        setStored(files.length);
      });
    },
  };
}

export type MediaLibraryUpload = ReturnType<typeof useMediaLibraryUpload>;
