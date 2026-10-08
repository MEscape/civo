'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { Provider } from 'react-redux';

import { createComponentCatalog } from '../../application/contracts/editor-model';
import { savePageConfigAction } from '../actions/save-page-config-action';
import { createBuilderStore } from '../state/builder-store';

import { BuilderSessionContext } from './builder-session-context';

import type { DatasetOptionsByKind } from '../dto/dataset-options-dto';
import type { EditorSessionDto } from '../dto/editor-session-dto';

export interface BuilderSessionProviderProps {
  readonly session: EditorSessionDto;
  readonly datasetOptions: DatasetOptionsByKind;
  readonly children: ReactNode;
}

/** Hex only: a derived node id must stay inside the id alphabet and length limits. */
function createIdSeed(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

/**
 * Owns one editing session: its store and catalog. Render it with
 * `key={session.page.id}` so another page starts a fresh session. Only the
 * builder route tree is wrapped; the public site never loads Redux.
 */
export function BuilderSessionProvider({
  session,
  datasetOptions,
  children,
}: BuilderSessionProviderProps) {
  const [runtime] = useState(() => {
    const catalog = createComponentCatalog(session.components);
    return {
      store: createBuilderStore(session, {
        catalog,
        savePageConfig: savePageConfigAction,
        createIdSeed,
      }),
      context: { catalog, datasetOptions },
    };
  });

  return (
    <Provider store={runtime.store}>
      <BuilderSessionContext.Provider value={runtime.context}>
        {children}
      </BuilderSessionContext.Provider>
    </Provider>
  );
}
