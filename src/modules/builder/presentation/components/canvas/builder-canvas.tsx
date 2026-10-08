import { useState } from 'react';
import type { RefObject } from 'react';

import { useTranslations } from '@i18n/client';

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
export function BuilderCanvas({ themeStyle, containerRef, dnd }: BuilderCanvasProps) {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const nodes = useBuilderSelector(selectChildren);
  const selectedNodeId = useBuilderSelector(selectSelectedNodeId);
  const viewport = useBuilderSelector(selectViewport);
  const [hoveredNodeId, setHoveredNodeId] = useState<PageNodeId | null>(null);

  const { node, isRendering, errorCode } = useCanvasRender(nodes);
  const rects = useNodeRects(containerRef, node);
  const selection = useCanvasSelection((id) => dispatch(nodeSelected(id)), setHoveredNodeId);

  return (
    <ViewportFrame viewport={viewport}>
      <div className="civo-canvas rounded-token border border-border bg-canvas">
        <div ref={containerRef} className="civo-canvas-content" {...selection}>
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
