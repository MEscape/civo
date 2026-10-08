import type { ReactNode } from 'react';

import { Monitor, Smartphone, Tablet } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { VIEWPORT_MESSAGE_KEYS } from '../../messages/message-keys';
import { viewportChanged } from '../../state/builder-actions';
import { useBuilderDispatch, useBuilderSelector } from '../../state/builder-hooks';
import { selectMode, selectViewport } from '../../state/builder-selectors';
import { VIEWPORTS } from '../../state/ui-state';

import { ToolbarIconButton } from './toolbar-icon-button';

import type { Viewport } from '../../state/ui-state';

const VIEWPORT_ICONS = {
  desktop: <Monitor className="h-3.5 w-3.5" aria-hidden="true" />,
  tablet: <Tablet className="h-3.5 w-3.5" aria-hidden="true" />,
  mobile: <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />,
} as const satisfies Record<Viewport, ReactNode>;

/** Sizes only apply to the editing canvas, so the group is absent in preview mode. */
export function ToolbarViewportControls() {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const mode = useBuilderSelector(selectMode);
  const viewport = useBuilderSelector(selectViewport);
  if (mode !== 'select') {
    return null;
  }

  return (
    <div
      role="group"
      aria-label={t('toolbar.viewports')}
      className="flex items-center gap-1 rounded-token border border-border p-0.5"
    >
      {VIEWPORTS.map((candidate) => (
        <ToolbarIconButton
          key={candidate}
          icon={VIEWPORT_ICONS[candidate]}
          label={t(VIEWPORT_MESSAGE_KEYS[candidate])}
          isPressed={viewport === candidate}
          onClick={() => dispatch(viewportChanged(candidate))}
        />
      ))}
    </div>
  );
}
