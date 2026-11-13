import { AdminPageHeader } from '@components/layout/admin-page';
import { Badge } from '@components/ui/badge';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { publishedByLabel } from '../../authors/published-by-label';
import { STATUS_MESSAGE_KEYS } from '../../messages/message-keys';
import { releaseRoutes } from '../../routes';
import { ReleaseStatusBadge } from '../releases/release-status-badge';
import { RestoreReleaseButton } from '../releases/restore-release-button';

import { PreviewNeighbourNav } from './preview-neighbour-nav';

import type { ReleasePreviewScreen } from '../../loaders/load-release-preview';

export interface PreviewHeaderProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly screen: ReleasePreviewScreen;
  /** Whether the actor may restore this release; the server still authorizes. */
  readonly mayRollback: boolean;
}

/**
 * Which release this is and where it sits: the breadcrumb back to the page of the list it came
 * from, the number with its state, the note, when and by whom it was published, and, as the
 * page's actions, the releases next to it and the restore.
 */
export async function PreviewHeader({
  locale,
  websiteId,
  screen,
  mayRollback,
}: PreviewHeaderProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'release' }),
    getAppFormatters(),
  ]);
  const { release, authors, from, older, newer } = screen;
  const when = release.publishedAt ?? release.createdAt;
  const author = publishedByLabel(t, release.publishedBy, authors);
  const title = t('preview.title', { number: release.releaseNumber });

  return (
    <AdminPageHeader
      title={title}
      description={release.note ?? undefined}
      breadcrumbLabel={t('preview.breadcrumb')}
      crumbs={[
        { label: t('pages.releases.title'), href: releaseRoutes.releasesAt(websiteId, from) },
        { label: title },
      ]}
      meta={
        <p className="flex flex-wrap items-center gap-2 text-sm text-copy-muted">
          {release.isActive && <Badge variant="success">{t('preview.live')}</Badge>}
          {release.status !== 'published' && (
            <ReleaseStatusBadge
              status={release.status}
              label={t(STATUS_MESSAGE_KEYS[release.status])}
            />
          )}
          <span>
            <time dateTime={when.toISOString()}>{format.dateTime(when)}</time>
            {author !== null && ` · ${author}`}
          </span>
        </p>
      }
      actions={
        <>
          <PreviewNeighbourNav
            locale={locale}
            websiteId={websiteId}
            from={from}
            older={older}
            newer={newer}
          />
          {mayRollback && release.canRollback && (
            <RestoreReleaseButton
              websiteId={websiteId}
              releaseId={release.id}
              releaseNumber={release.releaseNumber}
              publishedAt={when.toISOString()}
            />
          )}
        </>
      }
    />
  );
}
