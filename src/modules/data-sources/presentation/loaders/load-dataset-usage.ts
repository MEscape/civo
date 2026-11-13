import type { Locale } from '@i18n';

import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import type { DatasetUse, DatasetUsage } from '../dto/dataset-usage-dto';

/** A saved map as the usage reads it: its layers name the datasets it shows. */
interface SavedMapLayers {
  readonly id: string;
  readonly name: string;
  readonly settings: { readonly layers: ReadonlyArray<{ readonly datasetId: string }> };
}

/** The integration boundary supplies neighbour readers and their addresses, avoiding a module cycle. */
export interface DatasetUsageReaders {
  readonly drafts: {
    execute(websiteId: string): AppResultAsync<{
      readonly byDataset: Readonly<
        Record<
          string,
          ReadonlyArray<{
            readonly pageId: string;
            readonly title: string;
            readonly components: ReadonlyArray<{ readonly nodeId: string; readonly type: string }>;
          }>
        >
      >;
      readonly awaiting: ReadonlyArray<{
        readonly pageId: string;
        readonly title: string;
        readonly nodeId: string;
        readonly type: string;
        readonly kind: string;
      }>;
      readonly isTruncated: boolean;
    }>;
  };
  readonly live: {
    execute(
      websiteId: string,
    ): AppResultAsync<Readonly<Record<string, ReadonlyArray<{ readonly title: string }>>>>;
  };
  /** The saved maps of the website (one page of at most the list maximum) with their layers. */
  readonly maps: {
    execute(websiteId: string): AppResultAsync<{
      readonly items: readonly SavedMapLayers[];
      readonly total: number;
    }>;
  };
  readonly labels: (
    locale: Locale,
    types: readonly string[],
  ) => Promise<Readonly<Record<string, string>>>;
  readonly editorHref: (websiteId: string, pageId: string) => string;
  readonly componentHref: (websiteId: string, pageId: string, nodeId: string) => string;
  readonly releasesHref: (websiteId: string) => string;
  readonly mapHref: (websiteId: string, mapId: string) => string;
}

type UseEntry = readonly [datasetId: string, use: DatasetUse];

/** Each saved map, under every dataset one of its layers reads; two layers of one dataset are one use. */
function mapUses(
  maps: readonly SavedMapLayers[],
  hrefOf: (mapId: string) => string,
): readonly UseEntry[] {
  return maps.flatMap((map) =>
    unique(map.settings.layers.map((layer) => layer.datasetId)).map((datasetId): UseEntry => [
      datasetId,
      { title: map.name, href: hrefOf(map.id), where: 'map', components: [] },
    ]),
  );
}

function byDatasetOf(entries: readonly UseEntry[]): DatasetUsage {
  const usage: Record<string, DatasetUse[]> = {};
  for (const [datasetId, use] of entries) {
    (usage[datasetId] ??= []).push(use);
  }
  return usage;
}

/** An incomplete read must never describe an unchecked dataset as unused. Deletion still checks on the server. */
export async function loadDatasetUsage(
  websiteId: string,
  locale: Locale,
  readers: DatasetUsageReaders | null,
) {
  const unavailable = { usage: null, awaiting: [], state: 'unavailable' as const };
  if (readers === null) {
    return unavailable;
  }
  const [drafts, live, maps] = await Promise.all([
    readers.drafts.execute(websiteId),
    readers.live.execute(websiteId),
    readers.maps.execute(websiteId),
  ]);
  if (drafts.isErr() || live.isErr() || maps.isErr()) {
    return unavailable;
  }
  // The deletion guard counts every saved map, so a partial list must not read as complete.
  if (drafts.value.isTruncated || maps.value.total > maps.value.items.length) {
    return { ...unavailable, state: 'incomplete' as const };
  }
  const { byDataset, awaiting } = drafts.value;
  const types = unique([
    ...Object.values(byDataset).flatMap((pages) =>
      pages.flatMap((page) => page.components.map((component) => component.type)),
    ),
    ...awaiting.map((component) => component.type),
  ]);
  const labels = await readers.labels(locale, types);
  const usage = byDatasetOf([
    ...Object.entries(byDataset).flatMap(([datasetId, pages]) =>
      pages.map((page): UseEntry => [
        datasetId,
        {
          title: page.title,
          href: readers.editorHref(websiteId, page.pageId),
          where: 'draft',
          components: page.components.map((component) => ({
            label: labels[component.type] ?? component.type,
            href: readers.componentHref(websiteId, page.pageId, component.nodeId),
          })),
        },
      ]),
    ),
    ...Object.entries(live.value).flatMap(([datasetId, pages]) =>
      pages.map((page): UseEntry => [
        datasetId,
        { title: page.title, href: readers.releasesHref(websiteId), where: 'live', components: [] },
      ]),
    ),
    ...mapUses(maps.value.items, (mapId) => readers.mapHref(websiteId, mapId)),
  ]);
  return {
    usage,
    awaiting: awaiting.map((component) => ({
      label: labels[component.type] ?? component.type,
      page: component.title,
      kind: component.kind,
      href: readers.componentHref(websiteId, component.pageId, component.nodeId),
    })),
    state: 'complete' as const,
  };
}
