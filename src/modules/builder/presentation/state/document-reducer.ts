import {
  commitSnapshot,
  createHistory,
  finishPropsEdit,
  markSaved,
  redoEdit,
  selectNodeInHistory,
  undoEdit,
  updatePropsInPlace,
} from '../../application/contracts/editor-model';

import {
  editRedone,
  editUndone,
  nodeSelected,
  propsEditFinished,
  propsUpdated,
  saveSucceeded,
  snapshotCommitted,
} from './builder-actions';

import type { DocumentHistory, PageConfig } from '../../application/contracts/editor-model';
import type { UnknownAction } from '@reduxjs/toolkit';

export interface DocumentState {
  readonly pageId: string;
  /** The revision the editor holds: sent back as `expectedVersion` on the next save. */
  readonly version: number;
  readonly history: DocumentHistory;
}

export function createDocumentState(page: {
  readonly id: string;
  readonly version: number;
  readonly config: PageConfig;
}): DocumentState {
  return {
    pageId: page.id,
    version: page.version,
    history: createHistory(page.config.children),
  };
}

const EMPTY_DOCUMENT_STATE = createDocumentState({
  id: '',
  version: 0,
  config: { type: 'page', children: [] },
});

/**
 * A thin adapter: every rule (limits, coalescing, dirtiness) lives in the
 * domain's history functions. Plain functions, no Immer, so no draft types
 * leak into the readonly domain model.
 */
export function documentReducer(
  state: DocumentState = EMPTY_DOCUMENT_STATE,
  action: UnknownAction,
): DocumentState {
  if (snapshotCommitted.match(action)) {
    return { ...state, history: commitSnapshot(state.history, action.payload) };
  }
  if (propsUpdated.match(action)) {
    return {
      ...state,
      history: updatePropsInPlace(state.history, action.payload),
    };
  }
  if (propsEditFinished.match(action)) {
    return { ...state, history: finishPropsEdit(state.history) };
  }
  if (nodeSelected.match(action)) {
    return {
      ...state,
      history: selectNodeInHistory(state.history, action.payload),
    };
  }
  if (editUndone.match(action)) {
    return { ...state, history: undoEdit(state.history) };
  }
  if (editRedone.match(action)) {
    return { ...state, history: redoEdit(state.history) };
  }
  if (saveSucceeded.match(action)) {
    return {
      ...state,
      version: action.payload.version,
      history: markSaved(state.history, action.payload.savedChildren),
    };
  }
  return state;
}
