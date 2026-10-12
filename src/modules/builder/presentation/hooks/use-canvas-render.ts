import { startTransition, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { requestDraftRender } from '../render/request-draft-render';
import { useBuilderSelector } from '../state/builder-hooks';
import { selectPageId } from '../state/builder-selectors';

import type { PageNode } from '../../application/contracts/editor-model';

const RENDER_DEBOUNCE_MS = 250;

export interface CanvasRenderState {
  readonly node: ReactNode;
  readonly isRendering: boolean;
  readonly errorCode: string | null;
}

const INITIAL_STATE: CanvasRenderState = {
  node: null,
  isRendering: true,
  errorCode: null,
};

/**
 * Debounce-renders the draft through the server, so rapid prop edits do
 * not cost a round trip per keystroke. A superseded request is ignored by
 * its effect cleanup, never applied late. The last good render stays on
 * screen while a newer one is pending or has failed.
 *
 * A render is applied in a transition: its client components (the map, the
 * charts) arrive as lazily loaded chunks of the server's payload, and without
 * a transition React would fall back to the nearest Suspense boundary, hide the
 * content already on the canvas and tear down its effects on every edit. In a
 * transition the old content stays until the new one is ready.
 */
export function useCanvasRender(children: readonly PageNode[]): CanvasRenderState {
  const pageId = useBuilderSelector(selectPageId);
  const [state, setState] = useState(INITIAL_STATE);

  useEffect(() => {
    let isCurrent = true;
    const timeout = setTimeout(() => {
      setState((previous) =>
        previous.isRendering ? previous : { ...previous, isRendering: true },
      );
      void requestDraftRender(pageId, children).then((outcome) => {
        if (!isCurrent) {
          return;
        }
        startTransition(() => {
          setState((previous) =>
            outcome.ok
              ? { node: outcome.node, isRendering: false, errorCode: null }
              : { ...previous, isRendering: false, errorCode: outcome.errorCode },
          );
        });
      });
    }, RENDER_DEBOUNCE_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timeout);
    };
  }, [pageId, children]);

  return state;
}
