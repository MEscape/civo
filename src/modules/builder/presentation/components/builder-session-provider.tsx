'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';

import { Provider } from 'react-redux';

import { createComponentCatalog } from '../../application/contracts/editor-model';
import { savePageConfigAction } from '../actions/save-page-config-action';
import { NO_CATEGORY_OPTIONS } from '../dto/category-options-dto';
import { BuilderSessionContext } from '../state/builder-session-context';
import { createBuilderStore } from '../state/builder-store';

import type { CategoryOptionsDto } from '../dto/category-options-dto';
import type { DatasetOptionsByKind } from '../dto/dataset-options-dto';
import type { EditorSessionDto } from '../dto/editor-session-dto';

export interface BuilderSessionProviderProps {
  readonly session: EditorSessionDto;
  readonly datasetOptions: DatasetOptionsByKind;
  /** Category values for `category` controls; omitted when no component asks for them. */
  readonly categoryOptions?: CategoryOptionsDto;
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
  categoryOptions = NO_CATEGORY_OPTIONS,
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
      context: { catalog, datasetOptions, categoryOptions },
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
