import {
  modeChanged,
  noticeDismissed,
  noticeRaised,
  snapshotCommitted,
  viewportChanged,
} from './builder-actions';
import { createUiState } from './ui-state';

import type { UiState } from './ui-state';
import type { UnknownAction } from '@reduxjs/toolkit';

const INITIAL_UI_STATE = createUiState('municipality'); // fail-closed default; always preloaded

export function uiReducer(state: UiState = INITIAL_UI_STATE, action: UnknownAction): UiState {
  if (modeChanged.match(action)) {
    return { ...state, mode: action.payload };
  }
  if (viewportChanged.match(action)) {
    return { ...state, viewport: action.payload };
  }
  if (noticeRaised.match(action)) {
    return { ...state, noticeCode: action.payload };
  }
  // A successful edit supersedes an earlier rejection notice.
  if (noticeDismissed.match(action) || snapshotCommitted.match(action)) {
    return state.noticeCode === null ? state : { ...state, noticeCode: null };
  }
  return state;
}
