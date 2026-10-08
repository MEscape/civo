import { useTranslations } from '@i18n/client';

import { findNode } from '../../../application/contracts/editor-model';
import { useComponentText } from '../../hooks/use-component-text';
import { useBuilderSelector } from '../../state/builder-hooks';
import { selectChildren } from '../../state/builder-selectors';

import type { PageNodeId } from '../../../application/contracts/editor-model';
import type { CanvasDnd } from '../../hooks/use-canvas-dnd';

export interface DragAnnouncerProps {
  readonly dnd: Pick<CanvasDnd, 'session' | 'target' | 'isKeyboard'>;
}

/**
 * Speaks keyboard drag progress through a live region. Pointer drags are
 * not announced: a pointer user sees the indicator, and announcing every
 * pointer move would only be noise.
 */
export function DragAnnouncer({ dnd }: DragAnnouncerProps) {
  const t = useTranslations('builder');
  const nodes = useBuilderSelector(selectChildren);
  const text = useComponentText();
  const { session, target, isKeyboard } = dnd;

  function labelOfNode(nodeId: PageNodeId): string {
    const node = findNode(nodes, nodeId);
    return node === null ? '' : text.componentLabel(node.type);
  }

  function message(): string {
    if (session === null || !isKeyboard) {
      return '';
    }
    if (target === null) {
      return t('drag.pickedUp', { label: session.label });
    }
    if (target.kind === 'root') {
      return t('drag.root', { label: session.label });
    }

    const targetLabel = labelOfNode(target.targetNodeId);
    if (target.kind === 'inside') {
      return t('drag.inside', { label: session.label, target: targetLabel });
    }
    return target.position === 'before'
      ? t('drag.before', { label: session.label, target: targetLabel })
      : t('drag.after', { label: session.label, target: targetLabel });
  }

  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message()}
    </div>
  );
}
