import { Suspense } from 'react';

import { createPortal } from 'react-dom';

import { useTranslations } from '@i18n/client';

import { useComponentPreview } from '../../hooks/use-component-preview';
import { useComponentText } from '../../hooks/use-component-text';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { useBuilderSession } from '../../state/builder-session-context';
import { CanvasThemeScope } from '../canvas/canvas-theme-scope';
import { RenderSkeleton } from '../canvas/render-skeleton';

import type { ThemeStyle } from '../canvas/canvas-theme-scope';

const PREVIEW_SCALE = 0.4;
const POPOVER_HEIGHT_PX = 250;
const VIEWPORT_PADDING_PX = 20;
const ANCHOR_GAP_PX = 10;

export interface ComponentPreviewPopoverProps {
  readonly componentType: string | null;
  readonly anchorRect: DOMRect | null;
  readonly themeStyle: ThemeStyle;
}

/** Aligned with the hovered row; shifted up when it would run off the bottom of the screen. */
function popoverTop(anchor: DOMRect): number {
  const fitsBelow = anchor.top + POPOVER_HEIGHT_PX + VIEWPORT_PADDING_PX <= window.innerHeight;
  return fitsBelow ? anchor.top : Math.max(VIEWPORT_PADDING_PX, anchor.bottom - POPOVER_HEIGHT_PX);
}

/**
 * A scaled-down live rendering of the hovered component, clipped by the
 * popover's fixed-size stage (a transform does not shrink the layout box, but
 * the clipped overflow is never seen, so the content needs no measuring: a
 * measured wrapper showed the unscaled page for a frame on every hover). A visual aid
 * only, so it is hidden from assistive technology: the palette button's
 * own name is the accessible one. It exists only after a hover or focus,
 * i.e. on the client, so touching `document` here is safe.
 */
export function ComponentPreviewPopover({
  componentType,
  anchorRect,
  themeStyle,
}: ComponentPreviewPopoverProps) {
  const t = useTranslations('builder');
  const { catalog } = useBuilderSession();
  const text = useComponentText();
  const { node, isLoading, errorCode } = useComponentPreview(componentType);

  const descriptor = componentType === null ? null : catalog.describe(componentType);
  if (descriptor === null || anchorRect === null) {
    return null;
  }
  const description = text.componentDescription(descriptor.type);

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-30 flex h-62.5 w-90 flex-col overflow-hidden rounded-token border border-border bg-surface shadow-lg"
      style={{
        top: popoverTop(anchorRect),
        left: anchorRect.right + ANCHOR_GAP_PX,
      }}
    >
      <div className="flex-none border-b border-border px-3.5 py-2.5">
        <div className="text-xs font-semibold text-copy">
          {text.componentLabel(descriptor.type)}
        </div>
        {description !== null && (
          <div className="mt-0.5 text-xs leading-snug text-copy-muted">{description}</div>
        )}
      </div>
      <div className="flex-1 overflow-hidden bg-canvas">
        <Suspense fallback={<RenderSkeleton isCompact label={t('preview.rendering')} />}>
          {isLoading && <RenderSkeleton isCompact label={t('preview.rendering')} />}
          {errorCode !== null && (
            <div className="flex h-full min-h-40 items-center justify-center p-6 text-center text-xs text-danger">
              {t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}
            </div>
          )}
          {node !== null && (
            <div className="w-225 origin-top-left" style={{ transform: `scale(${PREVIEW_SCALE})` }}>
              <CanvasThemeScope themeStyle={themeStyle}>{node}</CanvasThemeScope>
            </div>
          )}
        </Suspense>
      </div>
    </div>,
    document.body,
  );
}
