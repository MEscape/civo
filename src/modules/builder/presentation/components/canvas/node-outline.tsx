import type { ReactNode } from 'react';

import { useTranslations } from '@i18n/client';

import { findNode } from '../../../application/contracts/editor-model';
import { useComponentText } from '../../hooks/use-component-text';
import { useBuilderSession } from '../../state/builder-session-context';

import type { PageNode, PageNodeId, Rect } from '../../../application/contracts/editor-model';

const OUTLINE_BASE =
  'pointer-events-none absolute rounded-sm transition-[top,left,width,height] duration-75 motion-reduce:transition-none';

const OUTLINE_CLASS = {
  hover: `${OUTLINE_BASE} outline-1 outline-secondary`,
  selected: `${OUTLINE_BASE} outline-2 outline-accent`,
} as const;

const LABEL_BASE =
  'absolute -top-6 left-0 flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-accent-foreground';

/** A hover label lets clicks pass through to select the node; the selected one carries its actions. */
const LABEL_CLASS = {
  hover: `${LABEL_BASE} pointer-events-none bg-secondary opacity-80`,
  selected: `${LABEL_BASE} pointer-events-auto bg-accent`,
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
