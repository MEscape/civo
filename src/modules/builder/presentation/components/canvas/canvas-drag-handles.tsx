// @ui-plain button editor chrome: a gesture surface (pointer and keyboard drag) with its own focus ring and hit area, which Button would change
import { GripVertical } from '@components/icons/icons';

import { useTranslations } from '@i18n/client';

import { flattenNodes } from '../../../application/contracts/editor-model';
import { useComponentText } from '../../hooks/use-component-text';

import type { PageNode, PageNodeId, Rect } from '../../../application/contracts/editor-model';
import type { CanvasDnd } from '../../hooks/use-canvas-dnd';

const HANDLE_OFFSET_PX = 4;

/** Invisible until focused or picked up, so only keyboard users see the grips. */
const HANDLE_CLASSES = [
  'pointer-events-auto absolute z-15 flex size-5 cursor-grab items-center justify-center rounded-sm border border-transparent bg-transparent p-0 text-copy-muted opacity-0',
  'focus-visible:border-border focus-visible:bg-surface focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
  'aria-pressed:cursor-grabbing aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:opacity-100',
].join(' ');

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
            className={HANDLE_CLASSES}
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
