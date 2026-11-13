'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MapController, MapLifecycle } from '@hooks/use-map-renderer';

import { useTranslations } from '@i18n/client';

import type MapboxGl from 'mapbox-gl';
import type { Map as MapboxMap, Marker } from 'mapbox-gl';

export type MapPointTone = 'primary' | 'warning' | 'muted';

/** One place on a `PointMap`: where it is, how it is named for assistive technology and what its pin says. */
export interface MapPoint {
  readonly id: string;
  readonly lng: number;
  readonly lat: number;
  /** The place's name: the pin's accessible name. */
  readonly label: string;
  /** What the pin shows (a number, a letter); empty for a plain dot. */
  readonly text: string;
  readonly tone: MapPointTone;
}

/* --- MarkerLayer: the pins, drawn as DOM buttons over the map --- */

const SINGLE_POINT_ZOOM = 14;
const MAX_FIT_ZOOM = 15;
const FIT_PADDING = 72;

/**
 * The pin is two elements. The outer one is the button Mapbox positions with an inline `transform`
 * (never styled with one itself: the individual `scale` property applies before `transform`, so
 * scaling the positioned element scales its offset too and the pin jumps across the map); the inner
 * face is what is drawn, and the one that grows when the pin is picked out.
 */
const PIN_BASE =
  'group size-8 cursor-pointer rounded-full outline-none focus-visible:ring-4 focus-visible:ring-focus/50 data-[active=true]:z-10';
const FACE_BASE =
  'flex size-full items-center justify-center rounded-full border-2 border-surface font-heading text-xs font-semibold shadow-md transition-[scale] motion-reduce:transition-none group-data-[active=true]:scale-125 group-data-[active=true]:ring-4 group-data-[active=true]:ring-focus/40';
const PIN_TONES: Record<MapPointTone, string> = {
  primary: 'bg-primary text-primary-foreground',
  warning: 'bg-warning text-status-foreground',
  muted: 'bg-copy-muted text-canvas',
};

export interface PointMapController extends MapController {
  setPoints(points: readonly MapPoint[]): void;
  setActive(id: string | null): void;
}

export interface MarkerLayerOptions {
  readonly mapboxgl: typeof MapboxGl;
  readonly map: MapboxMap;
  readonly onActiveChange: (id: string | null) => void;
  readonly onSelect: (id: string) => void;
  readonly prefersReducedMotion: boolean;
}

/** Draws points as DOM markers on a Mapbox map and keeps them, the picked-out one and the camera in step. */
export class MarkerLayer implements PointMapController {
  private readonly markers = new Map<string, { marker: Marker; element: HTMLButtonElement }>();
  private active: string | null = null;
  private fitted = '';

  constructor(private readonly options: MarkerLayerOptions) {}

  setPoints(points: readonly MapPoint[]): void {
    const { mapboxgl, map } = this.options;
    const ids = new Set(points.map((point) => point.id));
    for (const [id, { marker }] of this.markers) {
      if (!ids.has(id)) {
        marker.remove();
        this.markers.delete(id);
      }
    }
    for (const point of points) {
      const known = this.markers.get(point.id);
      if (known === undefined) {
        const element = this.pin(point);
        const marker = new mapboxgl.Marker({ element })
          .setLngLat([point.lng, point.lat])
          .addTo(map);
        this.markers.set(point.id, { marker, element });
      } else {
        known.marker.setLngLat([point.lng, point.lat]);
        this.paint(known.element, point);
      }
    }
    this.setActive(this.active);
    this.fit(points);
  }

  /** Marks the picked-out pin. The camera stays where it is: a hover in a list must not move the map under the pointer. */
  setActive(id: string | null): void {
    this.active = id;
    for (const [pointId, { element }] of this.markers) {
      element.dataset['active'] = String(pointId === id);
    }
  }

  resize(): void {
    this.options.map.resize();
  }

  destroy(): void {
    for (const { marker } of this.markers.values()) {
      marker.remove();
    }
    this.markers.clear();
    this.options.map.remove();
  }

  private pin(point: MapPoint): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button';
    const { onActiveChange, onSelect } = this.options;
    element.addEventListener('mouseenter', () => {
      onActiveChange(point.id);
    });
    element.addEventListener('mouseleave', () => {
      onActiveChange(null);
    });
    element.addEventListener('focus', () => {
      onActiveChange(point.id);
    });
    element.addEventListener('blur', () => {
      onActiveChange(null);
    });
    element.addEventListener('click', () => {
      onSelect(point.id);
    });
    this.paint(element, point);
    return element;
  }

  /**
   * Draws a pin's tone, text and name. The button's classes are added, never replaced as a whole:
   * Mapbox puts its own class on the marker's element (`mapboxgl-marker`, which positions it over
   * the map), and a pin painted again when more places arrive would lose it and drop out of the map.
   */
  private paint(element: HTMLButtonElement, point: MapPoint): void {
    element.classList.add(...PIN_BASE.split(' '));
    const face = element.firstElementChild ?? element.appendChild(document.createElement('span'));
    face.className = `${FACE_BASE} ${PIN_TONES[point.tone]}`;
    face.textContent = point.text;
    element.setAttribute('aria-label', point.label);
  }

  /** Moves the camera only when the set of places changed, never for a hover. */
  private fit(points: readonly MapPoint[]): void {
    const { mapboxgl, map, prefersReducedMotion } = this.options;
    const signature = points
      .map(({ id, lng, lat }) => `${id}:${String(lng)}:${String(lat)}`)
      .join('|');
    const [first] = points;
    if (first === undefined || signature === this.fitted) {
      return;
    }
    this.fitted = signature;
    const animate = !prefersReducedMotion;
    if (points.length === 1) {
      map.easeTo({ center: [first.lng, first.lat], zoom: SINGLE_POINT_ZOOM, animate });
      return;
    }
    const bounds = new mapboxgl.LngLatBounds([first.lng, first.lat], [first.lng, first.lat]);
    for (const point of points) {
      bounds.extend([point.lng, point.lat]);
    }
    map.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: MAX_FIT_ZOOM, animate });
  }
}

/* --- usePointMap --- */

const OVERVIEW_LONGITUDE = 10.4;
const OVERVIEW_LATITUDE = 51.1;
const OVERVIEW_ZOOM = 4;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

interface PointMapOptions {
  readonly accessToken: string;
  readonly styleUrl: string;
  readonly points: readonly MapPoint[];
  readonly activeId: string | null;
  readonly onActiveChange: ((id: string | null) => void) | undefined;
  readonly onSelect: ((id: string) => void) | undefined;
}

/**
 * Mounts a Mapbox map for `PointMap` and keeps its pins in step with the points. Mapbox's own
 * control texts are replaced with the app's; a refused token or a failed load ends in `isFailed`.
 * Handlers are read at call time, so a new callback never rebuilds the WebGL map.
 */
export function usePointMap({
  accessToken,
  styleUrl,
  points,
  activeId,
  onActiveChange,
  onSelect,
}: PointMapOptions) {
  const t = useTranslations('app');
  const [isFailed, setIsFailed] = useState(false);
  const latest = useRef({ onActiveChange, onSelect });
  const controls = useMemo(
    () => ({
      'NavigationControl.ZoomIn': t('map.zoomIn'),
      'NavigationControl.ZoomOut': t('map.zoomOut'),
      'ScrollZoomBlocker.CtrlMessage': t('map.scrollZoom'),
      'ScrollZoomBlocker.CmdMessage': t('map.scrollZoomMac'),
      'TouchPanBlocker.Message': t('map.touchPan'),
    }),
    [t],
  );
  const controlTexts = useRef(controls);
  useEffect(() => {
    latest.current = { onActiveChange, onSelect };
    controlTexts.current = controls;
  });

  const mount = useCallback(
    async (host: HTMLElement, lifecycle: MapLifecycle): Promise<PointMapController> => {
      try {
        const [{ default: mapboxgl }] = await Promise.all([
          import('mapbox-gl'),
          import('mapbox-gl/dist/mapbox-gl.css'),
        ]);
        mapboxgl.accessToken = accessToken;
        const map = new mapboxgl.Map({
          container: host,
          style: styleUrl,
          locale: { ...controlTexts.current },
          cooperativeGestures: true,
          center: [OVERVIEW_LONGITUDE, OVERVIEW_LATITUDE],
          zoom: OVERVIEW_ZOOM,
          respectPrefersReducedMotion: true,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
        map.on('load', () => {
          lifecycle.onReady();
        });
        map.on('error', (event) => {
          const status = (event.error as { status?: number } | undefined)?.status;
          if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
            setIsFailed(true);
            lifecycle.onFailure();
          }
        });
        return new MarkerLayer({
          mapboxgl,
          map,
          prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
          onActiveChange: (id) => {
            if (lifecycle.isActive()) {
              latest.current.onActiveChange?.(id);
            }
          },
          onSelect: (id) => {
            if (lifecycle.isActive()) {
              latest.current.onSelect?.(id);
            }
          },
        });
      } catch (error) {
        setIsFailed(true);
        lifecycle.onFailure();
        throw error;
      }
    },
    [accessToken, styleUrl],
  );

  const synchronize = useCallback(
    (layer: PointMapController) => {
      layer.setPoints(points);
      layer.setActive(activeId);
    },
    [points, activeId],
  );

  return {
    mount,
    synchronize,
    isFailed,
    loadingLabel: t('map.loading'),
    unavailableLabel: t('map.unavailable'),
  };
}
