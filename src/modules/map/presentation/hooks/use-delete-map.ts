'use client';

import { useState, useTransition } from 'react';

import { useRouter } from '@i18n';

import type { ActionResult } from '@lib/result';

/** Deletes a saved map that no page places; handed in by the route, which knows the pages. */
export type DeleteMapAction = (input: {
  readonly websiteId: string;
  readonly id: string;
}) => Promise<ActionResult<{ readonly id: string }>>;

interface DeleteMapFlowOptions {
  readonly websiteId: string;
  readonly mapId: string;
  readonly deleteMap: DeleteMapAction;
  /** The error code that says a page still places the map. */
  readonly inUseCode: string;
  /** Where to go once it is gone; absent: stay, the list around re-reads itself. */
  readonly afterDeleteHref?: string | undefined;
}

/**
 * The confirmed deletion of a map: the dialog's state, the call, and the refusal's code. When the
 * server refuses because a page took the map into use since this screen was read, the screen is
 * read again, so the dialog shows where instead of a stale "unused".
 */
export function useDeleteMap({
  websiteId,
  mapId,
  deleteMap,
  inUseCode,
  afterDeleteHref,
}: DeleteMapFlowOptions) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  return {
    isPending,
    isConfirming,
    errorCode,
    isInUse: errorCode === inUseCode,
    open: () => {
      setErrorCode(null);
      setIsConfirming(true);
    },
    close: () => {
      setIsConfirming(false);
    },
    confirm: () => {
      setErrorCode(null);
      startTransition(async () => {
        const result = await deleteMap({ websiteId, id: mapId });
        setIsConfirming(false);
        if (!result.ok) {
          setErrorCode(result.error.code);
          if (result.error.code === inUseCode) {
            router.refresh();
          }
        } else if (afterDeleteHref !== undefined) {
          router.replace(afterDeleteHref);
        }
      });
    },
  };
}
