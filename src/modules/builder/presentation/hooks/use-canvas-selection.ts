import type { MouseEvent } from 'react';

import { findNodeId } from '../dom/node-dom';

import type { PageNodeId } from '../../application/contracts/editor-model';

/**
 * Delegated selection and hover on the opaque rendered markup: the
 * components know nothing about the editor, the canvas only reads their
 * `data-civo-node-id`. Clicks are captured so links inside a preview
 * never navigate away from the editor.
 */
export function useCanvasSelection(
  onSelect: (nodeId: PageNodeId | null) => void,
  onHover: (nodeId: PageNodeId | null) => void,
) {
  return {
    onClickCapture(event: MouseEvent<HTMLElement>): void {
      onSelect(findNodeId(event.target));
      event.preventDefault();
    },
    onMouseOver(event: MouseEvent<HTMLElement>): void {
      onHover(findNodeId(event.target));
    },
    onMouseOut(): void {
      onHover(null);
    },
  };
}
