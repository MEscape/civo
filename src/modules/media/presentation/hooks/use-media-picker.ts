'use client';

import { useEffect, useState } from 'react';

import { MEDIA_PICKER_PAGE_SIZE } from '../../application/contracts/media-constraints';
import { listMediaAssetsAction } from '../actions/list-media-assets-action';
import { messageKeyForError } from '../messages/message-keys';

import { useMediaUpload } from './use-media-upload';

import type { MediaAssetDto, MediaAssetPageDto } from '../dto/media-dto';
import type { MessageKey } from '../messages/message-keys';

interface MediaPickerState {
  readonly websiteId: string;
  readonly value: string | undefined;
  readonly onChange: (assetId: string | undefined) => void;
  readonly onCommit?: (() => void) | undefined;
}

/**
 * The picker's state: the newest public images of the website (fetched when a preview or the
 * grid is needed), the ones uploaded here, and the upload itself. Only the id of the choice is
 * handed on. When the website holds more images than one page, `isTruncated` says so.
 */
export function useMediaPicker({ websiteId, value, onChange, onCommit }: MediaPickerState) {
  const { fileInput, isUploading, problem: uploadProblem, upload } = useMediaUpload(websiteId);
  // `null` until the first answer arrives: that is also what "loading" means.
  const [loaded, setLoaded] = useState<MediaAssetPageDto | null>(null);
  const [uploaded, setUploaded] = useState<readonly MediaAssetDto[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loadProblem, setLoadProblem] = useState<MessageKey | null>(null);

  // Fetched when a preview or the grid is needed; state is only set after the answer arrives,
  // never synchronously inside the effect.
  useEffect(() => {
    if (value === undefined && !isOpen) {
      return;
    }
    let cancelled = false;
    void listMediaAssetsAction({
      websiteId,
      pageSize: MEDIA_PICKER_PAGE_SIZE,
      visibility: 'public',
    }).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.ok) {
        setLoaded(result.data);
        setLoadProblem(null);
      } else {
        setLoadProblem(messageKeyForError(result.error));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [websiteId, value, isOpen]);

  const assets = [
    ...uploaded,
    ...(loaded?.items ?? []).filter((asset) => !uploaded.some((mine) => mine.id === asset.id)),
  ];

  function choose(assetId: string | undefined): void {
    onChange(assetId);
    onCommit?.();
    setIsOpen(false);
  }

  async function uploadFile(file: File | undefined): Promise<void> {
    const [stored] = file === undefined ? [] : await upload([file], 'public');
    if (stored !== undefined) {
      setUploaded((current) => [stored, ...current]);
      choose(stored.id);
    }
  }

  return {
    fileInput,
    isOpen,
    isUploading,
    isLoading: loaded === null && isOpen,
    isTruncated: loaded !== null && loaded.total > loaded.items.length,
    total: loaded?.total ?? 0,
    problem: uploadProblem ?? loadProblem,
    assets,
    chosen: assets.find((asset) => asset.id === value),
    choose,
    toggle: () => {
      setIsOpen((current) => !current);
    },
    uploadFile,
  };
}
