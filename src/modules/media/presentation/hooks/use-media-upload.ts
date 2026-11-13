'use client';

import { useRef, useState, useTransition } from 'react';

import { messageKeyForError } from '../messages/message-keys';
import { uploadMediaFile } from '../upload/upload-media-file';

import type { MediaVisibility } from '../../application/contracts/media-constraints';
import type { MediaAssetDto } from '../dto/media-dto';
import type { MessageKey } from '../messages/message-keys';

/**
 * Sends files to the website's store, one after the other: each upload is its own permission,
 * and a failure stops the rest. Files go straight from the browser to the store; the Server
 * Actions behind it authorize on their own. Resolves to the files that were stored.
 */
export function useMediaUpload(websiteId: string) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isUploading, startTransition] = useTransition();
  const [problem, setProblem] = useState<MessageKey | null>(null);

  /** Empties the chooser, so choosing the same file again is noticed. */
  function clearInput() {
    if (fileInput.current) {
      fileInput.current.value = '';
    }
  }

  function upload(
    files: readonly File[],
    visibility: MediaVisibility,
  ): Promise<readonly MediaAssetDto[]> {
    setProblem(null);
    return new Promise((resolve) => {
      startTransition(async () => {
        const stored: MediaAssetDto[] = [];
        for (const file of files) {
          const outcome = await uploadMediaFile(websiteId, file, visibility);
          if (!outcome.ok) {
            setProblem(messageKeyForError(outcome.error));
            break;
          }
          stored.push(outcome.asset);
        }
        clearInput();
        resolve(stored);
      });
    });
  }

  return { fileInput, isUploading, problem, upload, clearInput };
}
