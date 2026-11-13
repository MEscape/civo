import { setPath } from '@lib/utils';
import type { JsonValue } from '@lib/utils';

import { spatialFilterValue } from '../config/spatial-filter';

import type { AreaBounds, SpatialFilter } from '../config/spatial-filter';

type RequestBody = Readonly<Record<string, JsonValue>>;

/** What every request of a read starts from: the endpoint and the body of a POST source. */
export interface RequestBase {
  readonly endpoint: URL;
  readonly requestBody: RequestBody | null;
}

/**
 * The request base asking for one area, when the source can be asked and an area is wanted;
 * otherwise the base untouched. A GET source gets the condition as a query parameter, a POST source
 * as a value in its body. The values are numbers formatted here, so nothing a visitor sends can
 * reach the request as text.
 */
export function withArea(
  base: RequestBase,
  area: {
    readonly method: 'GET' | 'POST';
    readonly filter: SpatialFilter | null;
    readonly bounds: AreaBounds | undefined;
  },
): RequestBase {
  const { method, filter, bounds } = area;
  if (filter === null || bounds === undefined) {
    return base;
  }
  const value = spatialFilterValue(filter, bounds);
  if (method === 'POST') {
    return { ...base, requestBody: setPath({ ...base.requestBody }, filter.param, value) };
  }
  const endpoint = new URL(base.endpoint);
  endpoint.searchParams.set(filter.param, value);
  return { ...base, endpoint };
}
