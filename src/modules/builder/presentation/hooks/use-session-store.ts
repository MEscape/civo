import { useEffect, useState } from 'react';

import {
  createComponentCatalog,
  findNode,
  parsePageNodeId,
} from '../../application/contracts/editor-model';
import { savePageConfigAction } from '../actions/save-page-config-action';
import { nodeSelected } from '../state/builder-actions';
import { createBuilderStore } from '../state/builder-store';

import type { BookingChoicesDto } from '../dto/booking-choices-dto';
import type { CategoryOptionsDto } from '../dto/category-options-dto';
import type { DatasetOptionsByKind } from '../dto/dataset-options-dto';
import type { EditorSessionDto } from '../dto/editor-session-dto';

/** Hex only: a derived node id must stay inside the id alphabet and length limits. */
function createIdSeed(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

interface SessionStoreInput {
  readonly session: EditorSessionDto;
  readonly datasetOptions: DatasetOptionsByKind;
  readonly categoryOptions: CategoryOptionsDto;
  readonly bookingChoices: BookingChoicesDto;
  readonly initialSelection: string | undefined;
}

/**
 * One editing session: its catalog and store, the node the route asked to
 * select, and `discard`, which starts the store over from the last save.
 */
export function useSessionStore({
  session,
  datasetOptions,
  categoryOptions,
  bookingChoices,
  initialSelection,
}: SessionStoreInput) {
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

  return {
    store,
    context: { catalog, datasetOptions, categoryOptions, bookingChoices, discard },
  };
}
