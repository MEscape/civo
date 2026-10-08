import { createAction } from '@reduxjs/toolkit';

import type { BuilderMode, Viewport } from './ui-state';
import type {
  EditorSnapshot,
  PageNode,
  PageNodeId,
} from '../../application/contracts/editor-model';

export const snapshotCommitted = createAction<EditorSnapshot>('document/snapshotCommitted');
export const propsUpdated = createAction<readonly PageNode[]>('document/propsUpdated');
export const propsEditFinished = createAction('document/propsEditFinished');
export const nodeSelected = createAction<PageNodeId | null>('document/nodeSelected');
export const editUndone = createAction('document/editUndone');
export const editRedone = createAction('document/editRedone');

export const saveStarted = createAction('save/started');
export const saveSucceeded = createAction<{
  readonly version: number;
  readonly savedChildren: readonly PageNode[];
}>('save/succeeded');
export const saveFailed = createAction<string>('save/failed');

export const modeChanged = createAction<BuilderMode>('ui/modeChanged');
export const viewportChanged = createAction<Viewport>('ui/viewportChanged');
export const noticeRaised = createAction<string>('ui/noticeRaised');
export const noticeDismissed = createAction('ui/noticeDismissed');
