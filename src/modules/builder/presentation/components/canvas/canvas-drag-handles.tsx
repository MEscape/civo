import { GripVertical } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { flattenNodes } from '../../../application/contracts/editor-model';
import { useComponentText } from '../../hooks/use-component-text';

import type { PageNode, PageNodeId, Rect } from '../../../application/contracts/editor-model';
import type { CanvasDnd } from '../../hooks/use-canvas-dnd';

const HANDLE_OFFSET_PX = 4;

export interface CanvasDragHandlesProps {
  readonly nodes: readonly PageNode[];
  readonly rects: ReadonlyMap<PageNodeId, Rect>;
  readonly dnd: CanvasDnd;
}

/**
 * A real, focusable grip button at the top-left of every node. Keyboard
 * users tab to a grip, press Space or Enter to pick the node up, use the
 * arrow keys to choose a position and Space or Enter again to drop it. The
 * pointer path does not use these buttons: it drags the node itself.
 */
export function CanvasDragHandles({ nodes, rects, dnd }: CanvasDragHandlesProps) {
  const t = useTranslations('builder');
  const text = useComponentText();

  return (
    <>
      {flattenNodes(nodes).map(({ node }) => {
        const rect = rects.get(node.id);
        if (rect === undefined) {
          return null;
        }

        const label = text.componentLabel(node.type);
        const isActive = dnd.isKeyboard && dnd.session?.id === node.id;
        return (
          <button
            key={node.id}
            type="button"
            aria-label={
              isActive ? t('canvas.handle.moving', { label }) : t('canvas.handle.move', { label })
            }
            aria-pressed={isActive}
            onKeyDown={(event) => {
              dnd.handleGripKeyDown(node.id, event);
            }}
            className="civo-drag-handle"
            style={{
              top: rect.top + HANDLE_OFFSET_PX,
              left: rect.left + HANDLE_OFFSET_PX,
            }}
          >
            <GripVertical className="h-3 w-3" aria-hidden="true" />
          </button>
        );
      })}
    </>
  );
}
