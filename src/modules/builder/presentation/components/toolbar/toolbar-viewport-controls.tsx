import type { ReactNode } from 'react';

import { Monitor, Smartphone, Tablet } from '@components/icons/icons';

import { useTranslations } from '@i18n/client';

import { VIEWPORT_MESSAGE_KEYS } from '../../messages/message-keys';
import { viewportChanged } from '../../state/builder-actions';
import { useBuilderDispatch, useBuilderSelector } from '../../state/builder-hooks';
import { selectViewport } from '../../state/builder-selectors';
import { VIEWPORTS } from '../../state/ui-state';

import { ToolbarIconButton } from './toolbar-icon-button';

import type { Viewport } from '../../state/ui-state';

const VIEWPORT_ICONS = {
  desktop: <Monitor className="h-3.5 w-3.5" aria-hidden="true" />,
  tablet: <Tablet className="h-3.5 w-3.5" aria-hidden="true" />,
  mobile: <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />,
} as const satisfies Record<Viewport, ReactNode>;

/** The page's width on a phone, a tablet or a desktop: for editing, and above all for the preview. */
export function ToolbarViewportControls() {
  const t = useTranslations('builder');
  const dispatch = useBuilderDispatch();
  const viewport = useBuilderSelector(selectViewport);

  return (
    <div
      role="group"
      aria-label={t('toolbar.viewports')}
      className="hidden items-center gap-1 rounded-token border border-border p-0.5 md:flex"
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
