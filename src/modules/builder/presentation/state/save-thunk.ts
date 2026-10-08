import { CLIENT_ERROR_CODES } from '../messages/message-keys';

import { saveFailed, saveStarted, saveSucceeded } from './builder-actions';
import { selectIsDirty } from './builder-selectors';

import type { BuilderThunk } from './builder-thunk';

/**
 * Saves the draft as a new revision. The tree that was SENT becomes the
 * saved baseline, so edits made while the request was in flight stay dirty.
 * A stale editor surfaces as the version-conflict code; the draft is kept.
 */
export function saveDraft(): BuilderThunk<Promise<void>> {
  return async (dispatch, getState, { savePageConfig }) => {
    const state = getState();
    if (state.save.status === 'saving' || !selectIsDirty(state)) {
      return;
    }

    const sentChildren = state.document.history.present.children;
    dispatch(saveStarted());

    try {
      const result = await savePageConfig({
        pageId: state.document.pageId,
        expectedVersion: state.document.version,
        config: { type: 'page', children: sentChildren },
      });
      if (result.ok) {
        dispatch(
          saveSucceeded({
            version: result.data.version,
            savedChildren: sentChildren,
          }),
        );
      } else {
        dispatch(saveFailed(result.error.code));
      }
    } catch {
      // A rejected Server Action means the request never completed; the UI can only offer a retry.
      dispatch(saveFailed(CLIENT_ERROR_CODES.networkFailed));
    }
  };
}
