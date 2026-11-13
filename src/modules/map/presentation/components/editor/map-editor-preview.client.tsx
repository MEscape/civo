'use client';

import { useCallback } from 'react';

import { MapPin } from '@components/icons/icons';
import { EmptyState } from '@components/layout/layout-primitives';
import { DataPanel, DataPanelBody } from '@components/shared/data-panel';
import { FieldMessage } from '@components/shared/field';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { cn } from '@lib/utils';

import { previewMapWindowAction } from '../../actions/preview-map-window-action';
import { messageKeyForCode } from '../../messages/message-keys';
import { MAP_HEIGHT_CLASSES } from '../canvas/map-frame';
import { WindowedMap } from '../canvas/windowed-map.client';

import type { Bounds, MapHeight } from '../../../application/contracts/map-constraints';
import type { MapModel } from '../../../application/contracts/map-views';
import type { MapEditorValues } from '../../schemas/saved-map-schema';
import type { MapTiles } from '../canvas/map-canvas.client';

interface MapEditorPreviewProps {
  readonly websiteId: string;
  /** The form's current name, the map's heading. */
  readonly heading: string;
  /** The height the form asks for, so the empty placeholder already has the map's size. */
  readonly height: MapHeight;
  readonly preview: { readonly draft: MapEditorValues; readonly model: MapModel } | null;
  readonly tiles: MapTiles | null;
  readonly onBoundsChange: (bounds: Bounds) => void;
  /** A newer picture is on its way; the last one stays meanwhile. */
  readonly isDrawing: boolean;
  readonly errorCode: string | null;
  readonly onRetry: () => void;
  /** Changes when the view starts over: the map is built again from the start area. */
  readonly viewKey?: number | undefined;
}

/**
 * The map as it will look, drawn again on its own shortly after each valid change. The map stays
 * mounted while only the contents change; a new start area builds it again from that area.
 */
export function MapEditorPreview({
  websiteId,
  heading,
  height,
  preview,
  tiles,
  onBoundsChange,
  isDrawing,
  errorCode,
  onRetry,
  viewKey = 0,
}: MapEditorPreviewProps) {
  const t = useTranslations('map');
  const loadWindow = useCallback(
    (bounds: Bounds) => previewMapWindowAction({ websiteId, draft: preview?.draft, bounds }),
    [websiteId, preview],
  );
  return (
    <DataPanel
      title={t('management.preview')}
      description={t('management.previewHint')}
      footer={
        errorCode === null ? undefined : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldMessage
              id="map-preview-error"
              message={t(messageKeyForCode(errorCode, 'management.previewFailed'))}
            />
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              {t('states.retry')}
            </Button>
          </div>
        )
      }
    >
      <DataPanelBody className="relative">
        {/* Over the map's corner, not in the header: the note coming and going moves nothing. */}
        <span
          role="status"
          className={cn(
            'pointer-events-none absolute top-6 right-8 z-10 rounded-token-sm bg-surface/90 px-2 py-1 text-xs text-copy-muted shadow-sm transition-opacity',
            isDrawing ? 'opacity-100' : 'opacity-0',
          )}
        >
          {isDrawing ? t('management.previewDrawing') : ''}
        </span>
        {preview === null ? (
          <EmptyState
            variant="outlined"
            className={cn('px-6 py-0', MAP_HEIGHT_CLASSES[height])}
            icon={<MapPin className="size-6" aria-hidden="true" />}
            title={t('management.previewEmptyTitle')}
            description={t('management.previewEmpty')}
          />
        ) : (
          <WindowedMap
            key={`${preview.draft.settings.initialBounds.join(',')}:${String(viewKey)}`}
            heading={heading}
            model={preview.model}
            tiles={tiles}
            interaction={preview.draft.settings.interaction}
            showLegend={preview.draft.settings.showLegend}
            height={preview.draft.settings.height}
            unavailableLayers={0}
            initialBounds={preview.draft.settings.initialBounds}
            loadWindow={loadWindow}
            onBoundsChange={onBoundsChange}
          />
        )}
      </DataPanelBody>
    </DataPanel>
  );
}
