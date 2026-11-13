'use client';

import { Alert } from '@components/ui/alert';
import { Button } from '@components/ui/button';

import { useTranslations } from '@i18n/client';

import { useMapWindow } from '../../hooks/use-map-window';
import { MapExplorer } from '../explorer/map-explorer.client';

import type { Bounds } from '../../../application/contracts/map-constraints';
import type { LoadMapWindow } from '../../hooks/use-map-window';
import type { MapExplorerProps } from '../explorer/map-explorer.client';

interface WindowedMapProps extends Omit<MapExplorerProps, 'onViewportChange'> {
  readonly loadWindow: LoadMapWindow;
  readonly onBoundsChange?: ((bounds: Bounds) => void) | undefined;
}

/**
 * The explorer with its data read per viewport. The refreshing note is announced, not drawn above
 * the map: a line that appears and disappears on every pan would move the map under the pointer.
 */
export function WindowedMap({ loadWindow, onBoundsChange, ...props }: WindowedMapProps) {
  const t = useTranslations('map');
  const { model, state, handleViewportChange, retry } = useMapWindow(
    props.model,
    loadWindow,
    onBoundsChange,
  );

  return (
    <div className="space-y-3" aria-busy={state === 'loading'}>
      <p role="status" className="sr-only">
        {state === 'loading' ? t('states.refreshing') : ''}
      </p>
      {state === 'failed' && (
        <Alert variant="warning" role="status">
          <p>{t('states.refreshFailed')}</p>
          <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={retry}>
            {t('states.retry')}
          </Button>
        </Alert>
      )}
      <MapExplorer {...props} model={model} onViewportChange={handleViewportChange} />
    </div>
  );
}
