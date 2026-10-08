import { ChevronDown, ChevronUp, Copy, Trash2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { useBuilderDispatch } from '../../state/builder-hooks';
import { duplicateNodeById, moveNodeBy, removeNodeById } from '../../state/editing-thunks';

import type { PageNodeId } from '../../../application/contracts/editor-model';

const ACTION =
  'rounded-token-sm p-0.5 hover:bg-accent-foreground/10 focus-visible:outline-2 focus-visible:outline-accent-foreground';
const ICON = 'h-3 w-3';

export interface CanvasNodeActionsProps {
  readonly nodeId: PageNodeId;
}

/** Contextual actions for the selected node. */
export function CanvasNodeActions({ nodeId }: CanvasNodeActionsProps) {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label={t('canvas.actions.moveUp')}
        onClick={() => {
          dispatch(moveNodeBy(nodeId, -1));
        }}
        className={ACTION}
      >
        <ChevronUp className={ICON} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t('canvas.actions.moveDown')}
        onClick={() => {
          dispatch(moveNodeBy(nodeId, 1));
        }}
        className={ACTION}
      >
        <ChevronDown className={ICON} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t('canvas.actions.duplicate')}
        onClick={() => {
          dispatch(duplicateNodeById(nodeId));
        }}
        className={ACTION}
      >
        <Copy className={ICON} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t('canvas.actions.delete')}
        onClick={() => {
          dispatch(removeNodeById(nodeId));
        }}
        className={ACTION}
      >
        <Trash2 className={ICON} aria-hidden="true" />
      </button>
    </div>
  );
}
