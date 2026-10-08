import { saveFailed, saveStarted, saveSucceeded } from './builder-actions';

import type { UnknownAction } from '@reduxjs/toolkit';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveState {
  readonly status: SaveStatus;
  readonly errorCode: string | null;
}

const INITIAL_SAVE_STATE: SaveState = { status: 'idle', errorCode: null };

/** Dirtiness is not stored here: it is derived from the document history. */
export function saveReducer(
  state: SaveState = INITIAL_SAVE_STATE,
  action: UnknownAction,
): SaveState {
  if (saveStarted.match(action)) {
    return { status: 'saving', errorCode: null };
  }
  if (saveSucceeded.match(action)) {
    return { status: 'saved', errorCode: null };
  }
  if (saveFailed.match(action)) {
    return { status: 'error', errorCode: action.payload };
  }
  return state;
}
