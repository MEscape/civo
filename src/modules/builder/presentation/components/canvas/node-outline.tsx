import type { ReactNode } from 'react';

import { useTranslations } from '@i18n/client';

import { findNode } from '../../../application/contracts/editor-model';
import { useComponentText } from '../../hooks/use-component-text';
import { useBuilderSession } from '../builder-session-context';

import type { PageNode, PageNodeId, Rect } from '../../../application/contracts/editor-model';

const OUTLINE_CLASS = {
  hover: 'civo-canvas-outline civo-canvas-outline--hover',
  selected: 'civo-canvas-outline civo-canvas-outline--selected',
} as const;

const LABEL_CLASS = {
  hover: 'civo-canvas-label civo-canvas-label--hover',
  selected: 'civo-canvas-label',
} as const;

export interface NodeOutlineProps {
  readonly variant: keyof typeof OUTLINE_CLASS;
  readonly nodes: readonly PageNode[];
  readonly nodeId: PageNodeId;
  readonly rect: Rect;
  readonly children?: ReactNode;
}

/** A positioned outline with the component's name. The rect is measured layout, hence inline. */
export function NodeOutline({ variant, nodes, nodeId, rect, children }: NodeOutlineProps) {
  const t = useTranslations('builder');
  const { catalog } = useBuilderSession();
  const text = useComponentText();
  const type = findNode(nodes, nodeId)?.type;
  const label =
    type !== undefined && catalog.isRegistered(type)
      ? text.componentLabel(type)
      : t('canvas.unknownComponent');

  return (
    <div
      className={OUTLINE_CLASS[variant]}
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    >
      <div className={LABEL_CLASS[variant]}>
        <span>{label}</span>
        {children}
      </div>
    </div>
  );
}
