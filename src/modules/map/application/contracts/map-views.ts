import type { DataIssues, MapLayer } from '../../domain/features/map-features';
import type { FilterDefinition } from '../../domain/filters/filters';
import type { Bounds } from '../../domain/geo/geometry';
import type { LayerStyle } from '../../domain/style/layer-style';

/**
 * Everything the browser needs to draw and explore a map. Plain data:
 * validated, profiled and styled on the server, so the client does no
 * parsing of external data and no decisions about it.
 */
export interface MapModel {
  readonly layers: readonly MapLayer[];
  readonly styles: readonly LayerStyle[];
  readonly filters: readonly FilterDefinition[];
  /** Union of all layers; `null` when nothing can be drawn. */
  readonly bounds: Bounds | null;
  readonly featureCount: number;
  readonly issues: DataIssues;
}
