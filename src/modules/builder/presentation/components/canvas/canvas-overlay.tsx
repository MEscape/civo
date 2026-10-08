import { hasCapability } from '../../../application/contracts/editor-model';
import { useBuilderSelector } from '../../state/builder-hooks';
import { selectEditorMode } from '../../state/builder-selectors';

import { CanvasDragHandles } from './canvas-drag-handles';
import { CanvasNodeActions } from './canvas-node-actions';
import { DropIndicator } from './drop-indicator';
import { NodeOutline } from './node-outline';

import type { PageNode, PageNodeId, Rect } from '../../../application/contracts/editor-model';
import type { CanvasDnd } from '../../hooks/use-canvas-dnd';

export interface CanvasOverlayProps {
  readonly nodes: readonly PageNode[];
  readonly rects: ReadonlyMap<PageNodeId, Rect>;
  readonly selectedNodeId: PageNodeId | null;
  readonly hoveredNodeId: PageNodeId | null;
  readonly dnd: CanvasDnd;
}

export function CanvasOverlay({
  nodes,
  rects,
  selectedNodeId,
  hoveredNodeId,
  dnd,
}: CanvasOverlayProps) {
  const canEditStructure = hasCapability(useBuilderSelector(selectEditorMode), 'editStructure');
  const selectedRect = selectedNodeId === null ? undefined : rects.get(selectedNodeId);
  const hoveredRect =
    hoveredNodeId === null || hoveredNodeId === selectedNodeId
      ? undefined
      : rects.get(hoveredNodeId);

  return (
    <div className="civo-canvas-overlay">
      {hoveredNodeId !== null && hoveredRect !== undefined && (
        <NodeOutline variant="hover" nodes={nodes} nodeId={hoveredNodeId} rect={hoveredRect} />
      )}
      {selectedNodeId !== null && selectedRect !== undefined && (
        <NodeOutline variant="selected" nodes={nodes} nodeId={selectedNodeId} rect={selectedRect}>
          {canEditStructure && <CanvasNodeActions nodeId={selectedNodeId} />}
        </NodeOutline>
      )}
      {canEditStructure && <CanvasDragHandles nodes={nodes} rects={rects} dnd={dnd} />}
      <DropIndicator rect={dnd.indicator} />
    </div>
  );
}
