'use client';

import { MapCanvas as SharedMapCanvas } from '@components/shared/map-canvas';

import { useTranslations } from '@i18n/client';

import { useMapCanvas } from '../../hooks/use-map-canvas';

import type {
  Bounds,
  LayerStyle,
  MapFeature,
} from '../../../application/contracts/map-constraints';
import type { CreateMapRenderer } from '../../mapbox/create-mapbox-renderer';

export interface MapTiles {
  readonly accessToken: string;
  readonly styleUrl: string;
}

export interface MapCanvasProps {
  readonly tiles: MapTiles;
  readonly styles: readonly LayerStyle[];
  /** Features that currently pass the filters, per layer id. */
  readonly layers: ReadonlyArray<{
    readonly layerId: string;
    readonly features: readonly MapFeature[];
  }>;
  readonly initialBounds: Bounds | null;
  readonly selectedKey: string | null;
  /** When set, the view moves to this feature (e.g. picked from the list). */
  readonly focusKey: string | null;
  readonly isSelectable: boolean;
  readonly onSelect: (key: string | null) => void;
  readonly onStatusChange: (status: 'ready' | 'failed') => void;
  readonly createRenderer: CreateMapRenderer;
  readonly onViewportChange?: ((bounds: Bounds) => void) | undefined;
}

/** One map: the element Mapbox mounts into, with a loading note over it until the map is ready. */
export function MapCanvas(props: MapCanvasProps) {
  const t = useTranslations('map');
  const { mount, synchronize, placeholderSrc } = useMapCanvas(props);

  return (
    <SharedMapCanvas
      mount={mount}
      synchronize={synchronize}
      loadingLabel={t('canvas.loading')}
      placeholderSrc={placeholderSrc}
    />
  );
}
