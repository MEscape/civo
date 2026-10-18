'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { Provider } from 'react-redux';

import {
  createComponentCatalog,
  findNode,
  parsePageNodeId,
} from '../../application/contracts/editor-model';
import { savePageConfigAction } from '../actions/save-page-config-action';
import { NO_CATEGORY_OPTIONS } from '../dto/category-options-dto';
import { nodeSelected } from '../state/builder-actions';
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
  /** A component to select when the editor opens (`?select=`); ignored unless it is on the page. */
  readonly initialSelection?: string | undefined;
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
  initialSelection,
  children,
}: BuilderSessionProviderProps) {
  const [catalog] = useState(() => createComponentCatalog(session.components));
  const [store, setStore] = useState(() => createStore(session));

  // On opening, and again on every later link here: the route stays mounted while hidden (Activity).
  useEffect(() => {
    const selected = parsePageNodeId(initialSelection ?? '').unwrapOr(null);
    const nodes = store.getState().document.history.present.children;
    if (selected !== null && findNode(nodes, selected) !== null) {
      store.dispatch(nodeSelected(selected));
    }
  }, [initialSelection, store]);

  function createStore(from: EditorSessionDto) {
    return createBuilderStore(from, {
      catalog,
      savePageConfig: savePageConfigAction,
      createIdSeed,
    });
  }

  /**
   * Starts over from the last saved revision. The route stays mounted while
   * hidden (Cache Components keep a left page in `<Activity>`), so unsaved
   * work that was discarded on leaving would otherwise be there on return.
   */
  const discard = () => {
    const { document } = store.getState();
    setStore(
      createStore({
        ...session,
        page: {
          ...session.page,
          version: document.version,
          config: { ...session.page.config, children: document.history.savedChildren },
        },
      }),
    );
  };

  const context = { catalog, datasetOptions, categoryOptions, discard };

  return (
    <Provider store={store}>
      <BuilderSessionContext.Provider value={context}>{children}</BuilderSessionContext.Provider>
    </Provider>
  );
}
