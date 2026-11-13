import { Link } from '@i18n';

import type { DatasetUse } from '../../dto/dataset-usage-dto';
import type { DataSourcesTranslator } from '../../translation/translator';

interface DatasetUsedOnProps {
  readonly t: DataSourcesTranslator;
  /** The places showing the dataset; `null` when that is unknown. */
  readonly pages: readonly DatasetUse[] | null;
}

/**
 * Where the dataset is shown, so it is clear what a change or a deletion affects: each component
 * of a draft page and each saved map, linked to where it is changed. The live site is named only
 * when nothing else uses the dataset any more: publishing is then what remains.
 */
export function DatasetUsedOn({ t, pages }: DatasetUsedOnProps) {
  if (pages === null) {
    return <p className="text-xs text-copy-muted">{t('datasets.usageUnknown')}</p>;
  }
  const uses = [
    ...pages
      .filter((page) => page.where === 'draft')
      .flatMap((page) =>
        page.components.map((component) => ({
          href: component.href,
          label: t('datasets.useLabel', { page: page.title, component: component.label }),
        })),
      ),
    ...pages
      .filter((page) => page.where === 'map')
      .map((map) => ({ href: map.href, label: t('datasets.mapLabel', { map: map.title }) })),
  ];
  const live = pages.filter((page) => page.where === 'live');
  if (uses.length === 0 && live.length === 0) {
    return <p className="text-xs text-copy-muted">{t('datasets.unused')}</p>;
  }
  if (uses.length === 0) {
    return (
      <p className="text-xs text-copy-muted">
        {t('datasets.liveOnly', { pages: live.map((page) => page.title).join(', ') })}
      </p>
    );
  }
  return (
    <ul className="space-y-0.5 text-xs">
      {uses.map((use) => (
        <li key={use.href}>
          {/* Opens the editor with this very component selected, or the map's editor. */}
          <Link
            href={use.href}
            className="rounded-token-sm text-copy underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus"
          >
            {use.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
