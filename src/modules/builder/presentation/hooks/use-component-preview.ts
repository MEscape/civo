import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { createNodeFromBlueprint } from '../../application/contracts/editor-model';
import { useBuilderSession } from '../components/builder-session-context';
import { requestDraftRender } from '../render/request-draft-render';
import { useBuilderSelector } from '../state/builder-hooks';
import { selectPageId } from '../state/builder-selectors';

const HOVER_INTENT_MS = 300;
/** Fixed, valid seed: a preview node's id never reaches the document. */
const PREVIEW_ID_SEED = 'preview';

type PreviewEntry = { readonly node: ReactNode } | { readonly errorCode: string };

export interface PreviewState {
  readonly node: ReactNode;
  readonly isLoading: boolean;
  readonly errorCode: string | null;
}

const IDLE: PreviewState = { node: null, isLoading: false, errorCode: null };
const LOADING: PreviewState = { node: null, isLoading: true, errorCode: null };

/**
 * A live preview of one component, rendered by the same pipeline as the
 * canvas from the component's own default blueprint, so data-aware
 * components preview with real data. Successful results are cached for
 * the lifetime of the palette (owner: this hook instance; it disappears
 * with the editing session); failures are retried on the next hover. A
 * short hover-intent delay stops a sweep across the list from costing
 * a request per row.
 */
export function useComponentPreview(componentType: string | null): PreviewState {
  const pageId = useBuilderSelector(selectPageId);
  const { catalog } = useBuilderSession();
  const [entries, setEntries] = useState<ReadonlyMap<string, PreviewEntry>>(new Map());
  const cached = componentType === null ? undefined : entries.get(componentType);
  const needsFetch = componentType !== null && (cached === undefined || 'errorCode' in cached);

  useEffect(() => {
    if (componentType === null || !needsFetch) {
      return undefined;
    }
    let isCurrent = true;

    function remember(entry: PreviewEntry): void {
      if (isCurrent && componentType !== null) {
        setEntries((previous) => new Map(previous).set(componentType, entry));
      }
    }

    const timeout = setTimeout(() => {
      const descriptor = catalog.describe(componentType);
      if (descriptor === null) {
        return;
      }

      createNodeFromBlueprint(descriptor.blueprint, PREVIEW_ID_SEED).match(
        (node) => {
          void requestDraftRender(pageId, [node]).then((outcome) => {
            remember(outcome.ok ? { node: outcome.node } : { errorCode: outcome.errorCode });
          });
        },
        (error) => {
          remember({ errorCode: error.code });
        },
      );
    }, HOVER_INTENT_MS);

    return () => {
      isCurrent = false;
      clearTimeout(timeout);
    };
  }, [componentType, needsFetch, pageId, catalog]);

  if (componentType === null) {
    return IDLE;
  }
  if (cached === undefined) {
    return LOADING;
  }
  return 'errorCode' in cached
    ? { node: null, isLoading: false, errorCode: cached.errorCode }
    : { node: cached.node, isLoading: false, errorCode: null };
}
