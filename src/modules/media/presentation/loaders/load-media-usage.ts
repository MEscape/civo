import type { UnusedCheckUse } from '@components/shared/dialog';

import type { Locale } from '@i18n';

import type { AppResultAsync } from '@lib/result';
import { unique } from '@lib/utils';

/** The integration boundary supplies the builder's reader and addresses, avoiding a module cycle. */
export interface MediaUsageReaders {
  readonly drafts: (websiteId: string) => AppResultAsync<{
    readonly byAsset: Readonly<
      Record<
        string,
        ReadonlyArray<{
          readonly pageId: string;
          readonly title: string;
          readonly components: ReadonlyArray<{ readonly nodeId: string; readonly type: string }>;
        }>
      >
    >;
    readonly isTruncated: boolean;
  }>;
  readonly labels: (
    locale: Locale,
    types: readonly string[],
  ) => Promise<Readonly<Record<string, string>>>;
  readonly componentHref: (websiteId: string, pageId: string, nodeId: string) => string;
}

/** Where each file is still shown, by file id; `null` when that is unknown. */
export type MediaUses = Readonly<Record<string, readonly UnusedCheckUse[]>> | null;

/**
 * Which components of the saved pages show each file, each with a way into the editor. An
 * incomplete or failed read is "unknown", never "unused"; the delete itself still checks every
 * draft and release on the server.
 */
export async function loadMediaUsage(
  websiteId: string,
  locale: Locale,
  readers: MediaUsageReaders | null,
): Promise<MediaUses> {
  if (readers === null) {
    return null;
  }
  const drafts = await readers.drafts(websiteId);
  if (drafts.isErr() || drafts.value.isTruncated) {
    return null;
  }
  const { byAsset } = drafts.value;
  const labels = await readers.labels(
    locale,
    unique(
      Object.values(byAsset).flatMap((pages) =>
        pages.flatMap((page) => page.components.map((component) => component.type)),
      ),
    ),
  );
  return Object.fromEntries(
    Object.entries(byAsset).map(([assetId, pages]) => [
      assetId,
      pages.flatMap((page) =>
        page.components.map((component) => ({
          href: readers.componentHref(websiteId, page.pageId, component.nodeId),
          label: labels[component.type] ?? component.type,
          detail: page.title,
        })),
      ),
    ]),
  );
}
