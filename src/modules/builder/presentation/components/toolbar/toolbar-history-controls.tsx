import { Redo2, Undo2 } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { editRedone, editUndone } from '../../state/builder-actions';
import { useBuilderDispatch, useBuilderSelector } from '../../state/builder-hooks';
import { selectCanRedo, selectCanUndo } from '../../state/builder-selectors';

import { ToolbarIconButton } from './toolbar-icon-button';

export function ToolbarHistoryControls() {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const canUndo = useBuilderSelector(selectCanUndo);
  const canRedo = useBuilderSelector(selectCanRedo);

  return (
    <div
      role="group"
      aria-label={t('toolbar.history')}
      className="flex items-center gap-1 rounded-token border border-border p-0.5"
    >
      <ToolbarIconButton
        icon={<Undo2 className="h-3.5 w-3.5" aria-hidden="true" />}
        label={t('toolbar.undo')}
        isDisabled={!canUndo}
        onClick={() => dispatch(editUndone())}
      />
      <ToolbarIconButton
        icon={<Redo2 className="h-3.5 w-3.5" aria-hidden="true" />}
        label={t('toolbar.redo')}
        isDisabled={!canRedo}
        onClick={() => dispatch(editRedone())}
      />
    </div>
  );
}
