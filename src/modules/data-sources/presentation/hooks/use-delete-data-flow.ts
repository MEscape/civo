'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import { useDeleteData } from '../components/shared/delete-data';

import type { DeleteDataAction } from '../components/shared/delete-data';

interface DeleteDataFlowOptions {
  readonly deleteData: DeleteDataAction;
  readonly kind: 'dataset' | 'source';
  readonly id: string;
  /** Where to go once it is gone; absent: stay, the list around re-reads itself. */
  readonly afterDeleteHref?: string | undefined;
}

/** The confirmed deletion of a dataset or a source: the dialog's state, the call, and the refusal's code. */
export function useDeleteDataFlow({
  deleteData,
  kind,
  id,
  afterDeleteHref,
}: DeleteDataFlowOptions) {
  const router = useRouter();
  const remove = useDeleteData(deleteData);
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

  return {
    isPending,
    isConfirming,
    errorCode,
    open: () => {
      setIsConfirming(true);
    },
    close: () => {
      setIsConfirming(false);
    },
    confirm: () => {
      setErrorCode(undefined);
      startTransition(async () => {
        const result = await remove({ kind, id });
        setIsConfirming(false);
        if (!result.ok) {
          setErrorCode(result.error.code);
        } else if (afterDeleteHref !== undefined) {
          router.replace(afterDeleteHref);
        }
      });
    },
  };
}
