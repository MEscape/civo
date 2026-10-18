import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useSearchParams } from 'next/navigation';

import { useTranslations } from '@i18n/client';

import { NODE_ID_ATTRIBUTE } from '../../dom/node-dom';
import { useCanvasRender } from '../../hooks/use-canvas-render';
import { useCanvasSelection } from '../../hooks/use-canvas-selection';
import { useNodeRects } from '../../hooks/use-node-rects';
import { nodeSelected } from '../../state/builder-actions';
import { useBuilderDispatch, useBuilderSelector } from '../../state/builder-hooks';
import {
  selectChildren,
  selectSelectedNodeId,
  selectViewport,
} from '../../state/builder-selectors';
import { ErrorMessage } from '../feedback/error-message';

import { CanvasEmptyState } from './canvas-empty-state';
import { CanvasOverlay } from './canvas-overlay';
import { CanvasThemeScope } from './canvas-theme-scope';
import { ViewportFrame } from './viewport-frame';

import type { ThemeStyle } from './canvas-theme-scope';
import type { PageNodeId } from '../../../application/contracts/editor-model';
import type { CanvasDnd } from '../../hooks/use-canvas-dnd';
import './builder-canvas.css';

export interface BuilderCanvasProps {
  readonly themeStyle: ThemeStyle;
  readonly containerRef: RefObject<HTMLDivElement | null>;
  readonly dnd: CanvasDnd;
}

/**
 * The editing canvas. It renders the real server-rendered markup and maps
 * pointer events back to nodes through `data-civo-node-id`; selection
 * outlines, drag handles and the drop indicator live in a sibling overlay
 * so they can never leak into or be affected by the component styles.
 */
/** How long the canvas may still grow (charts, maps, images loading) while the link's component is kept in view. */
const SETTLE_MS = 2000;

/**
 * Places the component an editor link asks for (`?select=`) in view once
 * the canvas has drawn it, once per link: later selections are the editor's
 * own. Content that loads afterwards (data, maps) pushes it away, so while the
 * canvas settles it is brought back, until the visitor scrolls themselves.
 * Keyed on the link, not on mounting: a left editor stays mounted while
 * hidden (Activity), so what was revealed is forgotten when it hides.
 */
function useRevealLinkedSelection(
  containerRef: RefObject<HTMLDivElement | null>,
  rendered: unknown,
  selectedNodeId: PageNodeId | null,
): void {
  const requested = useSearchParams().get('select');
  const revealed = useRef<string | null>(null);

  // Runs its cleanup when Activity hides the editor, so the next link reveals again.
  useEffect(
    () => () => {
      revealed.current = null;
    },
    [],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null || rendered === null || requested === null) {
      return undefined;
    }
    if (requested === revealed.current || selectedNodeId !== requested) {
      return undefined;
    }
    revealed.current = requested;
    // Placed, not animated: the editor opens with the component already in view.
    const reveal = () => {
      container
        .querySelector(`[${NODE_ID_ATTRIBUTE}="${CSS.escape(requested)}"]`)
        ?.scrollIntoView({ block: 'center' });
    };
    reveal();

    const settling = new ResizeObserver(reveal);
    settling.observe(container);
    const stop = () => {
      settling.disconnect();
    };
    const timeout = window.setTimeout(stop, SETTLE_MS);
    // The visitor's own scrolling wins over keeping the component in view.
    window.addEventListener('wheel', stop, { once: true, passive: true });
    window.addEventListener('touchstart', stop, { once: true, passive: true });
    return () => {
      stop();
      window.clearTimeout(timeout);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
    };
  }, [containerRef, rendered, requested, selectedNodeId]);
}

export function BuilderCanvas({ themeStyle, containerRef, dnd }: BuilderCanvasProps) {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const nodes = useBuilderSelector(selectChildren);
  const selectedNodeId = useBuilderSelector(selectSelectedNodeId);
  const viewport = useBuilderSelector(selectViewport);
  const [hoveredNodeId, setHoveredNodeId] = useState<PageNodeId | null>(null);

  const { node, isRendering, errorCode } = useCanvasRender(nodes);
  const rects = useNodeRects(containerRef, node);
  useRevealLinkedSelection(containerRef, node, selectedNodeId);
  const selection = useCanvasSelection((id) => dispatch(nodeSelected(id)), setHoveredNodeId);

  return (
    <ViewportFrame viewport={viewport}>
      <div className="civo-canvas rounded-token border border-border bg-canvas">
        <div
          ref={containerRef}
          className="civo-canvas-content"
          // The selection handlers below swallow every click, so links here never leave the editor.
          data-navigation-guard-ignore=""
          {...selection}
        >
          {nodes.length === 0 ? (
            <CanvasEmptyState />
          ) : (
            <CanvasThemeScope themeStyle={themeStyle}>{node}</CanvasThemeScope>
          )}
        </div>
        <CanvasOverlay
          nodes={nodes}
          rects={rects}
          selectedNodeId={selectedNodeId}
          hoveredNodeId={hoveredNodeId}
          dnd={dnd}
        />
      </div>

      {isRendering && nodes.length > 0 && node === null && (
        <p role="status" className="mt-3 text-center text-xs text-copy-muted">
          {t('canvas.rendering')}
        </p>
      )}
      {errorCode !== null && <ErrorMessage code={errorCode} className="mt-3 text-center" />}
    </ViewportFrame>
  );
}
