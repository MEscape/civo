import { configureStore } from '@reduxjs/toolkit';

import type { ActionResult } from '@lib/result';

import { createDocumentState, documentReducer } from './document-reducer';
import { saveReducer } from './save-reducer';
import { uiReducer } from './ui-reducer';
import { createUiState } from './ui-state';

import type { ComponentCatalog } from '../../application/contracts/editor-model';
import type { EditorSessionDto } from '../dto/editor-session-dto';
import type { SavedRevisionDto } from '../dto/page-dto';

/** What thunks may use. Injected, so tests run them with fakes. */
export interface BuilderThunkExtra {
  readonly catalog: ComponentCatalog;
  readonly savePageConfig: (input: unknown) => Promise<ActionResult<SavedRevisionDto>>;
  /** Seeds derived node ids; the domain never generates randomness itself. */
  readonly createIdSeed: () => string;
}

/**
 * One isolated store per editing session, seeded from the server's
 * session. Nothing is shared between sessions or requests.
 */
export function createBuilderStore(session: EditorSessionDto, extra: BuilderThunkExtra) {
  return configureStore({
    reducer: { document: documentReducer, save: saveReducer, ui: uiReducer },
    preloadedState: {
      document: createDocumentState(session.page),
      ui: createUiState(session.editorMode),
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({ thunk: { extraArgument: extra } }),
  });
}

export type BuilderStore = ReturnType<typeof createBuilderStore>;
export type BuilderRootState = ReturnType<BuilderStore['getState']>;
export type BuilderDispatch = BuilderStore['dispatch'];
