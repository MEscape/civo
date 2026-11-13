'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { MEDIA_ERROR_CODES } from '../../application/contracts/media-constraints';
import { deleteMediaAssetAction } from '../actions/delete-media-asset-action';

/**
 * The confirmed deletion of a file: the dialog's state, the call, and the refusal's code. The
 * action invalidates the library, so a deleted file simply leaves the list. A refusal because the
 * file is still used re-reads the screen, so the dialog then shows where.
 */
export function useDeleteMediaAsset(websiteId: string, assetId: string) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

  return {
    isPending,
    isConfirming,
    errorCode,
    open: () => {
      setErrorCode(undefined);
      setIsConfirming(true);
    },
    close: () => {
      setIsConfirming(false);
    },
    confirm: () => {
      setErrorCode(undefined);
      startTransition(async () => {
        const result = await deleteMediaAssetAction({ websiteId, id: assetId });
        setIsConfirming(false);
        if (!result.ok) {
          setErrorCode(result.error.code);
          if (result.error.code === MEDIA_ERROR_CODES.inUse) {
            router.refresh();
          }
        }
      });
    },
  };
}
