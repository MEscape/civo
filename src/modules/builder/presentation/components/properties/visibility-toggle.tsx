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
    <div className="mb-4 flex items-center gap-2">
      <Switch
        id={id}
        checked={isVisible}
        onCheckedChange={(checked) => {
          dispatch(setNodeVisibility(nodeId, checked));
        }}
      />
      <Label htmlFor={id}>{t('properties.visible')}</Label>
    </div>
  );
}
