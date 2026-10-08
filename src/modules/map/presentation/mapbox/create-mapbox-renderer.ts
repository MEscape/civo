import { KEY_PROPERTY, buildLayerGroups, highlightFilters } from './mapbox-layers';

import type { LayerGroups, ResolvedPalette } from './mapbox-layers';
import type { Bounds, LayerStyle, MapFeature } from '../../application/contracts/map-constraints';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';

/** One layer as the renderer draws it: the style plus the features that currently pass the filters. */
export interface RenderLayer {
  readonly style: LayerStyle;
  readonly features: readonly MapFeature[];
}

export interface RendererOptions {
  readonly container: HTMLElement;
  readonly accessToken: string;
  readonly styleUrl: string;
  readonly palette: ResolvedPalette;
  /** Translated control and gesture hints; Mapbox ships English only. */
  readonly locale: Readonly<Record<string, string>>;
  readonly isSelectable: boolean;
  readonly prefersReducedMotion: boolean;
  readonly initialBounds: Bounds | null;
  readonly onSelect: (key: string | null) => void;
  /** Fired once the style is loaded and data can be shown. */
  readonly onReady: () => void;
  /** Fired when the map can no longer work (invalid token, style failed). */
  readonly onFailure: () => void;
}

/**
 * The surface the rest of the module uses to draw. Mapbox GL JS stays behind
 * it: a different renderer would implement this and nothing else changes.
 */
export interface MapRenderer {
  setLayers(layers: readonly RenderLayer[]): void;
  setSelected(key: string | null): void;
  /** Moves the view to a location, e.g. after picking it from the list. */
  showBounds(bounds: Bounds): void;
  destroy(): void;
}

export type CreateMapRenderer = (options: RendererOptions) => Promise<MapRenderer>;

const FIT_PADDING = 48;
const SINGLE_LOCATION_ZOOM = 14;
const MAX_FIT_ZOOM = 16;
const CLUSTER_RADIUS = 50;
const CLUSTER_MAX_ZOOM = 14;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
/** A token Mapbox rejects will not start working by retrying. */
const FATAL_STATUSES: ReadonlySet<number> = new Set([HTTP_UNAUTHORIZED, HTTP_FORBIDDEN]);
const WORLD_CENTER_LATITUDE = 20;
const WORLD_CENTER: [number, number] = [0, WORLD_CENTER_LATITUDE];
const WORLD_ZOOM = 1;

type GeoJsonFeature = Feature<Geometry, Record<string, string | number | boolean>>;

/** Built once per feature: a filter change reuses these instead of rebuilding GeoJSON. */
const GEOJSON_CACHE = new WeakMap<MapFeature, GeoJsonFeature>();

function toGeoJson(feature: MapFeature): GeoJsonFeature {
  let cached = GEOJSON_CACHE.get(feature);
  if (cached === undefined) {
    cached = {
      type: 'Feature',
      // Validated GeoJSON; only the readonly modifiers differ from the library's mutable typings.
      geometry: feature.geometry as unknown as Geometry,
      properties: { ...feature.attributes, [KEY_PROPERTY]: feature.key },
    };
    GEOJSON_CACHE.set(feature, cached);
  }
  return cached;
}

function sourceIdOf(layerId: string): string {
  return `src-${layerId}`;
}

class MapboxRenderer implements MapRenderer {
  private readonly groups = new Map<string, LayerGroups>();
  private isLoaded = false;
  private pending: readonly RenderLayer[] = [];
  private selectedKey: string | null = null;
  private areLayersAdded = false;

  constructor(
    private readonly map: MapboxMap,
    private readonly options: RendererOptions,
  ) {
    map.on('load', () => {
      this.isLoaded = true;
      this.apply();
      options.onReady();
    });
    map.on('error', (event) => {
      const status = (event.error as { status?: number } | undefined)?.status;
      // A tile or source that fails to load is a degraded map, not a broken one; the style or the token failing is fatal.
      const isDataError = 'sourceId' in event || 'tile' in event;
      const isAuthFailure = status !== undefined && FATAL_STATUSES.has(status);
      if (isAuthFailure || (!this.isLoaded && !isDataError)) {
        options.onFailure();
      }
    });
    if (options.isSelectable) {
      map.on('click', (event) => {
        this.handleClick(event);
      });
    }
  }

  setLayers(layers: readonly RenderLayer[]): void {
    this.pending = layers;
    if (this.isLoaded) {
      this.apply();
    }
  }

  setSelected(key: string | null): void {
    this.selectedKey = key;
    if (this.areLayersAdded) {
      this.applyHighlight();
    }
  }

  showBounds(bounds: Bounds): void {
    this.fit(bounds, { maxZoom: SINGLE_LOCATION_ZOOM });
  }

  destroy(): void {
    this.map.remove();
  }

  private fit(bounds: Bounds, extra: { maxZoom: number }): void {
    this.map.fitBounds(
      [
        [bounds[0], bounds[1]],
        [bounds[2], bounds[3]],
      ],
      { padding: FIT_PADDING, animate: !this.options.prefersReducedMotion, ...extra },
    );
  }

  private apply(): void {
    if (!this.areLayersAdded) {
      this.addLayers(this.pending);
      this.areLayersAdded = true;
      this.applyHighlight();
    } else {
      for (const layer of this.pending) {
        const source = this.map.getSource<GeoJSONSource>(sourceIdOf(layer.style.layerId));
        source?.setData(this.collection(layer));
      }
    }
  }

  private collection(layer: RenderLayer): FeatureCollection {
    return { type: 'FeatureCollection', features: layer.features.map(toGeoJson) };
  }

  private addLayers(layers: readonly RenderLayer[]): void {
    const { palette } = this.options;
    for (const layer of layers) {
      const sourceId = sourceIdOf(layer.style.layerId);
      this.map.addSource(sourceId, {
        type: 'geojson',
        data: this.collection(layer),
        ...(layer.style.pointStyle === 'clusters'
          ? { cluster: true, clusterRadius: CLUSTER_RADIUS, clusterMaxZoom: CLUSTER_MAX_ZOOM }
          : {}),
      });
      this.groups.set(
        layer.style.layerId,
        buildLayerGroups({ layerId: layer.style.layerId, sourceId, style: layer.style, palette }),
      );
    }
    // Areas first, then lines, then points: a district never hides the sensors inside it.
    const ordered = [...this.groups.values()];
    for (const pick of ['areas', 'lines', 'points', 'highlights'] as const) {
      for (const group of ordered) {
        for (const layer of group[pick]) {
          this.map.addLayer(layer);
        }
      }
    }

    const pointer = (isOver: boolean) => {
      this.map.getCanvas().style.cursor = isOver && this.options.isSelectable ? 'pointer' : '';
    };
    for (const group of ordered) {
      for (const id of group.interactiveIds) {
        this.map.on('mouseenter', id, () => {
          pointer(true);
        });
        this.map.on('mouseleave', id, () => {
          pointer(false);
        });
      }
    }
  }

  private applyHighlight(): void {
    const filters = highlightFilters(this.selectedKey);
    for (const [layerId] of this.groups) {
      this.map.setFilter(`${layerId}-hl-area`, filters.area);
      this.map.setFilter(`${layerId}-hl-line`, filters.line);
      this.map.setFilter(`${layerId}-hl-point`, filters.point);
    }
  }

  private handleClick(event: MapMouseEvent): void {
    const layers = [...this.groups.values()]
      .flatMap((group) => group.interactiveIds)
      .filter((id) => this.map.getLayer(id) !== undefined);
    const hit = this.map.queryRenderedFeatures(event.point, { layers })[0];
    const properties = hit?.properties ?? null;

    if (hit === undefined || properties === null) {
      this.options.onSelect(null);
      return;
    }
    if (typeof properties['cluster_id'] === 'number' && hit.source !== undefined) {
      this.zoomIntoCluster(hit.source, properties['cluster_id'], event.lngLat);
      return;
    }
    const key: unknown = properties[KEY_PROPERTY];
    this.options.onSelect(typeof key === 'string' ? key : null);
  }

  private zoomIntoCluster(
    sourceId: string,
    clusterId: number,
    at: { lng: number; lat: number },
  ): void {
    const source = this.map.getSource<GeoJSONSource>(sourceId);
    source?.getClusterExpansionZoom(clusterId, (error, zoom) => {
      if (error !== null && error !== undefined) {
        return;
      }
      this.map.easeTo({
        center: [at.lng, at.lat],
        zoom: zoom ?? this.map.getZoom() + 1,
        animate: !this.options.prefersReducedMotion,
      });
    });
  }
}

/** The one place Mapbox GL JS is imported, and only when a map is actually shown. */
export const createMapboxRenderer: CreateMapRenderer = async (options) => {
  const [{ default: mapboxgl }] = await Promise.all([
    import('mapbox-gl'),
    import('mapbox-gl/dist/mapbox-gl.css'),
  ]);

  mapboxgl.accessToken = options.accessToken;
  const map = new mapboxgl.Map({
    container: options.container,
    style: options.styleUrl,
    locale: { ...options.locale },
    // The map sits inside a scrolling page: gestures must not trap the scroll.
    cooperativeGestures: true,
    center: WORLD_CENTER,
    zoom: WORLD_ZOOM,
    respectPrefersReducedMotion: true,
    ...(options.initialBounds === null
      ? {}
      : {
          bounds: [
            [options.initialBounds[0], options.initialBounds[1]],
            [options.initialBounds[2], options.initialBounds[3]],
          ],
          fitBoundsOptions: { padding: FIT_PADDING, maxZoom: MAX_FIT_ZOOM },
        }),
  });
  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

  return new MapboxRenderer(map, options);
};
