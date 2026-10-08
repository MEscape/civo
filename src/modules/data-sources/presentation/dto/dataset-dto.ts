import { stringifyJson } from '@lib/utils';

import type {
  CanonicalKind,
  DatasetMappingView,
  DatasetView,
  DataSourceKind,
  DataSourceStatus,
  DiscoveredFieldView,
  DiscoveryView,
  MappingPreviewView,
} from '../../application/contracts/data-source-views';

export interface DatasetDto {
  readonly id: string;
  readonly websiteId: string;
  readonly sourceId: string;
  readonly sourceName: string;
  readonly sourceKind: DataSourceKind;
  readonly sourceStatus: DataSourceStatus;
  readonly name: string;
  readonly slug: string;
  readonly canonicalKind: CanonicalKind;
  readonly mapping: DatasetMappingView | null;
  readonly status: DataSourceStatus;
  readonly lastFetchedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toDatasetDto(view: DatasetView): DatasetDto {
  return {
    id: view.id,
    websiteId: view.websiteId,
    sourceId: view.source.id,
    sourceName: view.source.name,
    sourceKind: view.source.kind,
    sourceStatus: view.source.status,
    name: view.name,
    slug: view.slug,
    canonicalKind: view.canonicalKind,
    mapping: view.mapping,
    status: view.status,
    lastFetchedAt: view.lastFetchedAt?.toISOString() ?? null,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export interface DiscoveryDto {
  readonly fields: readonly DiscoveredFieldView[];
}

export function toDiscoveryDto(view: DiscoveryView): DiscoveryDto {
  return { fields: view.fields };
}

/** The preview is shown as text, so it is serialized once on the server (dates become ISO strings). */
export interface MappingPreviewDto {
  readonly json: string;
}

const PREVIEW_INDENT = 2;

export function toMappingPreviewDto(view: MappingPreviewView): MappingPreviewDto {
  return { json: stringifyJson(view.values, PREVIEW_INDENT) };
}
