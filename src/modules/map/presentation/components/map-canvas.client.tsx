'use client';

import { useEffect, useRef, useState } from 'react';

import { Spinner } from '@components/ui/icons';

import { useTranslations } from '@i18n/client';

import { geometryBounds, mergeBounds } from '../../application/contracts/map-constraints';
import { resolvePalette } from '../theme/map-palette';

import type { Bounds, LayerStyle, MapFeature } from '../../application/contracts/map-constraints';
import type { CreateMapRenderer, MapRenderer, RenderLayer } from '../mapbox/create-mapbox-renderer';

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
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

type Translate = ReturnType<typeof useTranslations<'map'>>;

/** Mapbox ships English control texts; these replace them. */
function controlLocale(t: Translate): Record<string, string> {
  return {
    'NavigationControl.ZoomIn': t('controls.zoomIn'),
    'NavigationControl.ZoomOut': t('controls.zoomOut'),
    'ScrollZoomBlocker.CtrlMessage': t('controls.scrollZoom'),
    'ScrollZoomBlocker.CmdMessage': t('controls.scrollZoomMac'),
    'TouchPanBlocker.Message': t('controls.touchPan'),
  };
}

function boundsOfFeature(layers: MapCanvasProps['layers'], key: string): Bounds | null {
  for (const layer of layers) {
    const feature = layer.features.find((candidate) => candidate.key === key);
    if (feature !== undefined) {
      return mergeBounds(null, geometryBounds(feature.geometry));
    }
  }
  return null;
}

/**
 * Owns the lifetime of one map: creates the renderer once, keeps it in sync
 * with React state, destroys it on unmount. Effects are used only for what
 * they are for here, synchronizing with an external system (the WebGL map).
 */
export function MapCanvas(props: MapCanvasProps) {
  const t = useTranslations('map');
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderer, setRenderer] = useState<MapRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The renderer is created once; it reads the latest callbacks and labels
  // through this ref, so a new selection, filter or render never rebuilds the map.
  const latest = useRef({ ...props, controlLocale: controlLocale(t) });
  useEffect(() => {
    latest.current = { ...props, controlLocale: controlLocale(t) };
  });
  const { tiles, createRenderer } = props;

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return undefined;
    }
    const initial = latest.current;
    let isCancelled = false;
    let created: MapRenderer | null = null;

    createRenderer({
      container,
      accessToken: tiles.accessToken,
      styleUrl: tiles.styleUrl,
      palette: resolvePalette(container),
      locale: initial.controlLocale,
      isSelectable: initial.isSelectable,
      prefersReducedMotion: prefersReducedMotion(),
      initialBounds: initial.initialBounds,
      onSelect: (key) => {
        latest.current.onSelect(key);
      },
      onReady: () => {
        setIsLoading(false);
        latest.current.onStatusChange('ready');
      },
      onFailure: () => {
        setIsLoading(false);
        latest.current.onStatusChange('failed');
      },
    })
      .then((instance) => {
        if (isCancelled) {
          instance.destroy();
          return;
        }
        created = instance;
        setRenderer(instance);
      })
      .catch(() => {
        // Initialization failed (blocked WebGL, chunk load): the list below stays fully usable.
        if (!isCancelled) {
          setIsLoading(false);
          latest.current.onStatusChange('failed');
        }
      });

    return () => {
      isCancelled = true;
      created?.destroy();
      setRenderer(null);
    };
  }, [createRenderer, tiles.accessToken, tiles.styleUrl]);

  const { styles, layers, selectedKey, focusKey } = props;

  useEffect(() => {
    renderer?.setLayers(
      layers.flatMap((layer): RenderLayer[] => {
        const style = styles.find((candidate) => candidate.layerId === layer.layerId);
        return style === undefined ? [] : [{ style, features: layer.features }];
      }),
    );
  }, [renderer, styles, layers]);

  useEffect(() => {
    renderer?.setSelected(selectedKey);
  }, [renderer, selectedKey]);

  useEffect(() => {
    if (renderer === null || focusKey === null) {
      return;
    }
    const bounds = boundsOfFeature(layers, focusKey);
    if (bounds !== null) {
      renderer.showBounds(bounds);
    }
    // Only a new focus request moves the view, not every filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `layers` is read at the moment of the request
  }, [renderer, focusKey]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {isLoading && (
        <div
          role="status"
          className="absolute inset-0 flex items-center justify-center gap-2 bg-canvas/80 text-sm text-copy-muted"
        >
          <Spinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {t('canvas.loading')}
        </div>
      )}
    </div>
  );
}
