'use client';

import { useRouter } from '@i18n';

import type { ActionResult } from '@lib/result';

import { DATA_SOURCE_ERROR_CODES } from '../../../application/contracts/data-source-constraints';

/**
 * Deletes a dataset or a whole source. Handed in by the route: this module
 * cannot see pages, so the deletion that first checks no page shows the
 * data lives in a module that can (release), and arrives here as an action.
 */
export type DeleteDataAction = (input: {
  readonly kind: 'dataset' | 'source';
  readonly id: string;
}) => Promise<ActionResult<{ readonly id: string }>>;

/**
 * The deletion, plus a re-read of the screen when the server refused because
 * a page took the data into use since this screen was read: the dialog then
 * shows where, instead of a stale "unused".
 */
export function useDeleteData(deleteData: DeleteDataAction): DeleteDataAction {
  const router = useRouter();
  return async (input) => {
    const result = await deleteData(input);
    if (!result.ok && result.error.code === DATA_SOURCE_ERROR_CODES.datasetInUse) {
      router.refresh();
    }
    return result;
  };
}
