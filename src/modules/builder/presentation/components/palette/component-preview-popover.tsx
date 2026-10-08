import { useRef } from 'react';

import { createPortal } from 'react-dom';

import { useScaledHeight } from '@hooks/use-scaled-height';

import { useTranslations } from '@i18n/client';

import { useComponentPreview } from '../../hooks/use-component-preview';
import { useComponentText } from '../../hooks/use-component-text';
import { MESSAGE_PARAMS, messageKeyForCode } from '../../messages/message-keys';
import { useBuilderSession } from '../builder-session-context';
import { CanvasThemeScope } from '../canvas/canvas-theme-scope';

import type { ThemeStyle } from '../canvas/canvas-theme-scope';
import './component-preview-popover.css';

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
 * A scaled-down live rendering of the hovered component. A visual aid
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
  const contentRef = useRef<HTMLDivElement>(null);
  const scaledHeight = useScaledHeight(contentRef, PREVIEW_SCALE, node !== null);

  const descriptor = componentType === null ? null : catalog.describe(componentType);
  if (descriptor === null || anchorRect === null) {
    return null;
  }
  const description = text.componentDescription(descriptor.type);

  return createPortal(
    <div
      aria-hidden="true"
      className="civo-preview-popover"
      style={{
        top: popoverTop(anchorRect),
        left: anchorRect.right + ANCHOR_GAP_PX,
      }}
    >
      <div className="civo-preview-popover__header">
        <div className="civo-preview-popover__label">{text.componentLabel(descriptor.type)}</div>
        {description !== null && (
          <div className="civo-preview-popover__description">{description}</div>
        )}
      </div>
      <div className="civo-preview-popover__stage">
        {isLoading && <div className="civo-preview-popover__status">{t('preview.rendering')}</div>}
        {errorCode !== null && (
          <div className="civo-preview-popover__status text-danger">
            {t(messageKeyForCode(errorCode), MESSAGE_PARAMS)}
          </div>
        )}
        {node !== null && (
          <div style={{ height: scaledHeight ?? 'auto' }}>
            <div
              ref={contentRef}
              className="civo-preview-popover__scale"
              style={{ transform: `scale(${PREVIEW_SCALE})` }}
            >
              <CanvasThemeScope themeStyle={themeStyle}>{node}</CanvasThemeScope>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
