import { groupBy } from '@lib/utils';

export interface DatasetOptionDto {
  readonly id: string;
  readonly name: string;
  readonly sourceName: string;
}

/**
 * Compatible datasets per canonical dataset type, loaded on the server for
 * the page's own website. The route builds it from the data-sources module;
 * the builder only displays it, so it never imports that module.
 */
export type DatasetOptionsByKind = Readonly<Record<string, readonly DatasetOptionDto[]>>;

/** One dataset as the route hands it over: the builder's own shape, not the data-sources view. */
export interface DatasetOptionInput extends DatasetOptionDto {
  readonly canonicalKind: string;
}

export function toDatasetOptionsByType(
  datasets: readonly DatasetOptionInput[],
): DatasetOptionsByKind {
  return Object.fromEntries(
    [...groupBy(datasets, (dataset) => dataset.canonicalKind)].map(([kind, options]) => [
      kind,
      options.map(({ id, name, sourceName }) => ({ id, name, sourceName })),
    ]),
  );
}
