'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';

import type { MapLifecycle } from '@hooks/use-map-renderer';

import { useTranslations } from '@i18n/client';

import { geometryBounds } from '../../application/contracts/map-constraints';
import { staticMapImageUrl } from '../mapbox/mapbox-static-image';
import { resolvePalette } from '../theme/map-palette';

import type { MapCanvasProps } from '../components/canvas/map-canvas.client';
import type { MapRenderer, RenderLayer } from '../mapbox/create-mapbox-renderer';

/** Mapbox ships English control texts; these replace them. */
function controlLocale(t: ReturnType<typeof useTranslations<'map'>>): Record<string, string> {
  return {
    'NavigationControl.ZoomIn': t('controls.zoomIn'),
    'NavigationControl.ZoomOut': t('controls.zoomOut'),
    'ScrollZoomBlocker.CtrlMessage': t('controls.scrollZoom'),
    'ScrollZoomBlocker.CmdMessage': t('controls.scrollZoomMac'),
    'TouchPanBlocker.Message': t('controls.touchPan'),
  };
}

/** The shared host owns lifetime; this bridge owns map vocabulary and synchronization with Mapbox. */
export function useMapCanvas(props: MapCanvasProps) {
  const t = useTranslations('map');
  // A selection, filter or translated label changes without rebuilding the WebGL map.
  const latest = useRef({ ...props, locale: controlLocale(t) });
  const focused = useRef<{ renderer: MapRenderer; key: string | null } | null>(null);
  useEffect(() => {
    latest.current = { ...props, locale: controlLocale(t) };
  });
  const { tiles, createRenderer } = props;
  const mount = useCallback(
    async (container: HTMLElement, lifecycle: MapLifecycle) => {
      let isAlive = true;
      try {
        const instance = await createRenderer({
          container,
          accessToken: tiles.accessToken,
          styleUrl: tiles.styleUrl,
          palette: resolvePalette(container),
          locale: latest.current.locale,
          isSelectable: latest.current.isSelectable,
          prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          initialBounds: latest.current.initialBounds,
          onSelect: (key) => {
            if (isAlive && lifecycle.isActive()) {
              latest.current.onSelect(key);
            }
          },
          onViewportChange:
            latest.current.onViewportChange === undefined
              ? undefined
              : (bounds) => {
                  if (isAlive && lifecycle.isActive()) {
                    latest.current.onViewportChange?.(bounds);
                  }
                },
          onReady: () => {
            if (isAlive && lifecycle.isActive()) {
              lifecycle.onReady();
              latest.current.onStatusChange('ready');
            }
          },
          onFailure: () => {
            if (isAlive && lifecycle.isActive()) {
              lifecycle.onFailure();
              latest.current.onStatusChange('failed');
            }
          },
        });
        return {
          setLayers: (layers: readonly RenderLayer[]) => {
            instance.setLayers(layers);
          },
          setSelected: (key: string | null) => {
            instance.setSelected(key);
          },
          showBounds: (bounds: Parameters<MapRenderer['showBounds']>[0]) => {
            instance.showBounds(bounds);
          },
          resize: () => instance.resize?.(),
          destroy: () => {
            isAlive = false;
            instance.destroy();
          },
        } satisfies MapRenderer;
      } catch (error) {
        lifecycle.onFailure();
        if (lifecycle.isActive()) {
          latest.current.onStatusChange('failed');
        }
        throw error;
      }
    },
    [createRenderer, tiles.accessToken, tiles.styleUrl],
  );

  const { styles, layers, selectedKey, focusKey } = props;
  const synchronize = useCallback(
    (renderer: MapRenderer) => {
      renderer.setLayers(
        layers.flatMap((layer): RenderLayer[] => {
          const style = styles.find((candidate) => candidate.layerId === layer.layerId);
          return style === undefined ? [] : [{ style, features: layer.features }];
        }),
      );
      renderer.setSelected(selectedKey);
      // Filtering or a new viewport batch never moves the camera; only an explicit focus request does.
      if (
        focusKey !== null &&
        (focused.current?.renderer !== renderer || focused.current.key !== focusKey)
      ) {
        const feature = layers
          .flatMap((layer) => layer.features)
          .find((candidate) => candidate.key === focusKey);
        if (feature !== undefined) {
          renderer.showBounds(geometryBounds(feature.geometry));
        }
      }
      focused.current = { renderer, key: focusKey };
    },
    [styles, layers, selectedKey, focusKey],
  );

  // A picture of the starting view for the placeholder; keyed by value, as bounds arrive as fresh arrays.
  const [west, south, east, north] = props.initialBounds ?? [];
  const placeholderSrc = useMemo(
    () =>
      staticMapImageUrl({
        accessToken: tiles.accessToken,
        styleUrl: tiles.styleUrl,
        bounds:
          west === undefined || south === undefined || east === undefined || north === undefined
            ? null
            : [west, south, east, north],
      }),
    [tiles.accessToken, tiles.styleUrl, west, south, east, north],
  );
  return { mount, synchronize, placeholderSrc };
}
