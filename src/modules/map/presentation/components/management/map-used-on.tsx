import { Link } from '@i18n';

import type { getTranslations } from '@i18n/server';

import type { MapUse } from '../../dto/map-usage-dto';

interface MapUsedOnProps {
  readonly t: Awaited<ReturnType<typeof getTranslations<'map'>>>;
  /** The pages placing the map; `null` when that is unknown. */
  readonly pages: readonly MapUse[] | null;
}

/** Where the map is placed, each component opening the editor with it selected. */
export function MapUsedOn({ t, pages }: MapUsedOnProps) {
  if (pages === null) {
    return <p className="text-xs text-copy-muted">{t('management.usageUnknownShort')}</p>;
  }
  const drafts = pages
    .filter((page) => !page.isLive)
    .flatMap((page) => page.components.map((component) => ({ ...component, page: page.title })));
  const live = pages.filter((page) => page.isLive);
  if (drafts.length === 0 && live.length === 0) {
    return <p className="text-xs text-copy-muted">{t('management.notPlaced')}</p>;
  }
  if (drafts.length === 0) {
    return (
      <p className="text-xs text-copy-muted">
        {t('management.liveOnly', { pages: live.map((page) => page.title).join(', ') })}
      </p>
    );
  }
  return (
    <ul className="space-y-0.5 text-xs">
      {drafts.map((use) => (
        <li key={use.href}>
          <Link href={use.href} className="text-copy underline-offset-2 hover:underline">
            {t('management.useLabel', { page: use.page, component: use.label })}
          </Link>
        </li>
      ))}
    </ul>
  );
}
