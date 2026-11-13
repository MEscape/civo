import type { Locale } from '@i18n';

import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

import type { MapAwaiting, MapUse, MapUsage } from '../dto/map-usage-dto';

/**
 * What the maps screens read from their neighbours, handed in by the route: the builder places
 * maps and the release knows the live site, so the map module cannot import them without a cycle.
 */
export interface MapUsageReaders {
  readonly drafts: (websiteId: string) => AppResultAsync<{
    readonly byMap: Readonly<
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
    }>;
    readonly isTruncated: boolean;
  }>;
  readonly live: (
    websiteId: string,
  ) => AppResultAsync<Readonly<Record<string, ReadonlyArray<{ readonly title: string }>>>>;
  readonly labels: (
    locale: Locale,
    types: readonly string[],
  ) => Promise<Readonly<Record<string, string>>>;
  readonly editorHref: (websiteId: string, pageId: string) => string;
  readonly componentHref: (websiteId: string, pageId: string, nodeId: string) => string;
  readonly releasesHref: (websiteId: string) => string;
}

/** Where each map is placed, and the map blocks still waiting for one. */
export interface MapUsageScreen {
  readonly usage: MapUsage;
  readonly awaiting: readonly MapAwaiting[];
}

const UNKNOWN: MapUsageScreen = { usage: null, awaiting: [] };

/** An incomplete read never calls a map unused; the deletion checks again on the server either way. */
export async function loadMapUsage(
  websiteId: string,
  locale: Locale,
  readers: MapUsageReaders | null,
): Promise<MapUsageScreen> {
  if (readers === null) {
    return UNKNOWN;
  }
  const [drafts, live] = await Promise.all([readers.drafts(websiteId), readers.live(websiteId)]);
  if (drafts.isErr() || live.isErr() || drafts.value.isTruncated) {
    return UNKNOWN;
  }
  const { byMap, awaiting } = drafts.value;
  const labels = await readers.labels(
    locale,
    unique([
      ...Object.values(byMap).flatMap((pages) =>
        pages.flatMap((page) => page.components.map((component) => component.type)),
      ),
      ...awaiting.map((component) => component.type),
    ]),
  );
  const usage: Record<string, MapUse[]> = {};
  for (const [mapId, pages] of Object.entries(byMap)) {
    usage[mapId] = pages.map((page) => ({
      title: page.title,
      href: readers.editorHref(websiteId, page.pageId),
      isLive: false,
      components: page.components.map((component) => ({
        label: labels[component.type] ?? component.type,
        href: readers.componentHref(websiteId, page.pageId, component.nodeId),
      })),
    }));
  }
  for (const [mapId, pages] of Object.entries(live.value)) {
    (usage[mapId] ??= []).push(
      ...pages.map((page) => ({
        title: page.title,
        href: readers.releasesHref(websiteId),
        isLive: true,
        components: [],
      })),
    );
  }
  return {
    usage,
    awaiting: awaiting.map((component) => ({
      label: labels[component.type] ?? component.type,
      page: component.title,
      href: readers.componentHref(websiteId, component.pageId, component.nodeId),
    })),
  };
}
