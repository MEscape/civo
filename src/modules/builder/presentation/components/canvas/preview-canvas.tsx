import { useTranslations } from '@i18n/client';

import { useCanvasRender } from '../../hooks/use-canvas-render';
import { useBuilderSelector } from '../../state/builder-hooks';
import { selectChildren, selectViewport } from '../../state/builder-selectors';
import { ErrorMessage } from '../feedback/error-message';

import { CanvasThemeScope } from './canvas-theme-scope';
import { ViewportFrame } from './viewport-frame';

import type { ThemeStyle } from './canvas-theme-scope';

export interface PreviewCanvasProps {
  readonly themeStyle: ThemeStyle;
}

/**
 * Preview mode: the same server-rendered draft as the canvas and the public
 * site, at a controlled width, with none of the editor chrome (no outlines,
 * handles or selection).
 */
export function PreviewCanvas({ themeStyle }: PreviewCanvasProps) {
  const t = useTranslations('builder');
  const nodes = useBuilderSelector(selectChildren);
  const viewport = useBuilderSelector(selectViewport);
  const { node, isRendering, errorCode } = useCanvasRender(nodes);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full min-h-96 items-center justify-center text-copy-muted">
        <p>{t('preview.empty')}</p>
      </div>
    );
  }

  return (
    <ViewportFrame viewport={viewport}>
      <CanvasThemeScope themeStyle={themeStyle} className="min-h-dvh shadow-2xl ring-1 ring-border">
        {node}
      </CanvasThemeScope>
      {isRendering && node === null && (
        <p role="status" className="mt-4 text-center text-sm text-copy-muted">
          {t('preview.rendering')}
        </p>
      )}
      {errorCode !== null && <ErrorMessage code={errorCode} className="mt-4 text-center text-sm" />}
    </ViewportFrame>
  );
}
