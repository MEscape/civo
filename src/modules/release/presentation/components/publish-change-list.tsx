'use client';

import { Badge } from '@components/ui/badge';

import { useTranslations } from '@i18n/client';

import {
  CHANGE_KIND_KEYS,
  CHANGE_KIND_VARIANTS,
  changeCountOf,
  settingsChangeKeys,
} from './change-kinds';
import { PagePathLabel } from './page-path-label';

import type { PublishButtonProps } from './publish-button';

type Translator = ReturnType<typeof useTranslations<'release'>>;

/** What the question says is about to happen. */
export function describe(
  draft: PublishButtonProps['draft'],
  isFirst: boolean,
  t: Translator,
): string {
  if (isFirst) {
    return t('publish.first');
  }
  return t('publish.changes', { count: changeCountOf(draft) });
}

export function ChangeList({
  draft,
  isFirst,
}: {
  readonly draft: PublishButtonProps['draft'];
  readonly isFirst: boolean;
}) {
  const t = useTranslations('release');
  const hidden = draft.pageChangeCount - draft.pageChanges.length;
  // A first release makes everything new, so the website's own settings are not listed apart.
  const settings = isFirst ? [] : settingsChangeKeys(draft);

  return (
    <ul className="divide-y divide-border rounded-token border border-border">
      {draft.pageChanges.map((change) => (
        <li key={change.path} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            <span className="font-medium text-copy">{change.title}</span>
            {change.path !== '' && (
              <span className="ml-2 text-xs text-copy-muted">
                <PagePathLabel path={change.path} />
              </span>
            )}
          </span>
          <Badge variant={CHANGE_KIND_VARIANTS[change.kind]} className="shrink-0">
            {t(CHANGE_KIND_KEYS[change.kind])}
          </Badge>
        </li>
      ))}
      {settings.map((key) => (
        <li key={key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            <span className="font-medium text-copy">{t(`publication.settings.${key}`)}</span>
            <span className="ml-2 text-xs text-copy-muted">{t('publication.settings.scope')}</span>
          </span>
          <Badge variant={CHANGE_KIND_VARIANTS.changed} className="shrink-0">
            {t(CHANGE_KIND_KEYS.changed)}
          </Badge>
        </li>
      ))}
      {hidden > 0 && (
        <li className="px-3 py-2 text-xs text-copy-muted">
          {t('publication.morePages', { count: hidden })}
        </li>
      )}
    </ul>
  );
}
