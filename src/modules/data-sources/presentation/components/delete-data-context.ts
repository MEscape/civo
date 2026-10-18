'use client';

import { createContext, useContext } from 'react';

import { useRouter } from '@i18n';

import type { ActionResult } from '@lib/result';
import { invariant } from '@lib/utils';

import { DATA_SOURCE_ERROR_CODES } from '../../application/contracts/data-source-constraints';

/**
 * Deletes a dataset or a whole source. Handed in by the route: this module
 * cannot see pages, so the deletion that first checks no page shows the
 * data lives in a module that can (release), and arrives here as an action.
 */
export type DeleteDataAction = (input: {
  readonly kind: 'dataset' | 'source';
  readonly id: string;
}) => Promise<ActionResult<{ readonly id: string }>>;

export const DeleteDataContext = createContext<DeleteDataAction | null>(null);

/**
 * The deletion, plus a re-read of the screen when the server refused because
 * a page took the data into use since this screen was read: the dialog then
 * shows where, instead of a stale "unused".
 */
export function useDeleteData(): DeleteDataAction {
  const deleteData = useContext(DeleteDataContext);
  const router = useRouter();
  invariant(deleteData !== null, 'useDeleteData must be used inside DataSourcesPanel.');
  return async (input) => {
    const result = await deleteData(input);
    if (!result.ok && result.error.code === DATA_SOURCE_ERROR_CODES.datasetInUse) {
      router.refresh();
    }
    return result;
  };
}
