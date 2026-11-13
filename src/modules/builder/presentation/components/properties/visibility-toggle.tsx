import { useId } from 'react';

import { Label } from '@components/ui/input';
import { Switch } from '@components/ui/switch';

import { useTranslations } from '@i18n/client';

import { useBuilderDispatch } from '../../state/builder-hooks';
import { setNodeVisibility } from '../../state/props-thunks';

import type { PageNodeId } from '../../../application/contracts/editor-model';

export interface VisibilityToggleProps {
  readonly nodeId: PageNodeId;
  readonly isVisible: boolean;
}

/** Hides or shows a component without deleting it. A discrete choice, so it is one undo step. */
export function VisibilityToggle({ nodeId, isVisible }: VisibilityToggleProps) {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const id = useId();

  return (
    <div className="mb-4 flex items-center justify-between gap-4 rounded-token border border-border bg-canvas p-3">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="cursor-pointer leading-normal">
          {t('properties.visible')}
        </Label>
        <p id={`${id}-hint`} className="text-xs text-copy-muted">
          {t(isVisible ? 'properties.visibleHint' : 'properties.hiddenHint')}
        </p>
      </div>
      <Switch
        id={id}
        aria-describedby={`${id}-hint`}
        checked={isVisible}
        onCheckedChange={(checked) => {
          dispatch(setNodeVisibility(nodeId, checked));
        }}
      />
    </div>
  );
}
