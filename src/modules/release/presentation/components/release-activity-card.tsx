import { OverviewCard, OverviewRow } from '@components/shared/overview-card';

import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { releaseRoutes } from '../routes';

import type { PublicationStatusView } from '../../application/contracts/release-views';

export interface ReleaseActivityCardProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly status: PublicationStatusView;
  /** The link to the whole history is only offered to someone who may open it. */
  readonly linkToReleases: boolean;
  /** The names of those who published, by actor id. */
  readonly authors: Readonly<Record<string, string>> | null;
}

/** The last few releases as a short history: what was published, the note that went with it, who did it and how long ago. */
export async function ReleaseActivityCard({
  locale,
  websiteId,
  status,
  linkToReleases,
  authors,
}: ReleaseActivityCardProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'release' }),
    getAppFormatters(),
  ]);

  return (
    <OverviewCard
      title={t('activity.title')}
      {...(linkToReleases
        ? { link: { href: releaseRoutes.releases(websiteId), label: t('publication.allReleases') } }
        : {})}
    >
      {status.recent.length === 0 ? (
        <OverviewRow>
          <p className="text-sm text-copy-muted">{t('activity.empty')}</p>
        </OverviewRow>
      ) : (
        status.recent.map((release) => {
          const when = release.publishedAt ?? release.createdAt;
          const author = release.publishedBy === null ? undefined : authors?.[release.publishedBy];

          return (
            <OverviewRow key={release.id} className="space-y-0.5">
              <p className="text-sm font-medium text-copy">
                {t('activity.published', { number: release.releaseNumber })}
              </p>
              {release.note !== null && <p className="text-sm text-copy-muted">{release.note}</p>}
              <p className="text-xs text-copy-muted">
                {author !== undefined && `${t('activity.by', { name: author })} · `}
                <time dateTime={when.toISOString()} title={format.dateTime(when)}>
                  {format.relativeTime(when, status.checkedAt)}
                </time>
              </p>
            </OverviewRow>
          );
        })
      )}
    </OverviewCard>
  );
}
