import { ChevronDown, ChevronUp, Copy, Trash2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { stepPlacement } from '../../../application/contracts/editor-model';
import { useBuilderDispatch, useBuilderSelector } from '../../state/builder-hooks';
import { selectChildren } from '../../state/builder-selectors';
import { duplicateNodeById, moveNodeBy, removeNodeById } from '../../state/editing-thunks';

import type { PageNodeId } from '../../../application/contracts/editor-model';

const ACTION =
  'rounded-token-sm p-0.5 hover:bg-accent-foreground/10 focus-visible:outline-2 focus-visible:outline-accent-foreground disabled:pointer-events-none disabled:opacity-40';
const ICON = 'h-3 w-3';

export interface CanvasNodeActionsProps {
  readonly nodeId: PageNodeId;
}

/** Contextual actions for the selected node. */
export function CanvasNodeActions({ nodeId }: CanvasNodeActionsProps) {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const children = useBuilderSelector(selectChildren);
  const canMoveUp = stepPlacement(children, nodeId, -1) !== null;
  const canMoveDown = stepPlacement(children, nodeId, 1) !== null;

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        aria-label={t('canvas.actions.moveUp')}
        disabled={!canMoveUp}
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
        disabled={!canMoveDown}
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
