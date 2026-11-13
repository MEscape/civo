import { ContentLink } from '@components/ui/content-link';

import { getAppFormatters, getNow, getTranslations } from '@i18n/server';

import type { ContentProvenance } from '../../../application/contracts/component-platform-constraints';

interface SourceAttributionProps {
  readonly sources: readonly ContentProvenance[];
  readonly rejected?: number | undefined;
}

/** One shared rendering path for license, dated freshness, and explicit fictional-data disclosure. */
export async function SourceAttribution({ sources, rejected = 0 }: SourceAttributionProps) {
  const [t, format] = await Promise.all([getTranslations('componentPlatform'), getAppFormatters()]);
  // A block reading several datasets of one capture (a dashboard) names that capture once.
  const distinct = [
    ...new Map(sources.map((source) => [`${source.sourceId}@${source.fetchedAt}`, source])),
  ];
  const now = sources.some((source) => source.validUntil !== null) ? await getNow() : null;
  return (
    <div className="mx-auto mt-6 max-w-7xl space-y-2 px-4 text-sm text-copy-muted sm:px-6 lg:px-8">
      {distinct.map(([key, source]) => (
        <div key={key} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {source.kind === 'synthetic' && (
            <strong className="text-copy">{t('provenance.synthetic')}</strong>
          )}
          <span>
            {source.kind === 'snapshot' ? t('provenance.snapshot') : t('provenance.asOf')}
          </span>
          <time dateTime={source.fetchedAt}>{format.dateTime(source.fetchedAt)}</time>
          {now !== null &&
            source.validUntil !== null &&
            Date.parse(source.validUntil) < now.getTime() && (
              <strong className="text-copy">{t('provenance.stale')}</strong>
            )}
          {source.sourceUrl !== null && (
            <ContentLink href={source.sourceUrl} className="inline-flex min-h-6 items-center">
              {source.attribution ?? source.sourceId}
            </ContentLink>
          )}
          {source.license !== null && (
            <details>
              <summary className="min-h-6 cursor-pointer underline underline-offset-4">
                {t('provenance.license')}
              </summary>
              {source.licenseUrl === null ? (
                <p className="max-w-prose py-2">{source.license}</p>
              ) : (
                <ContentLink
                  href={source.licenseUrl}
                  className="inline-flex min-h-6 items-center py-2"
                >
                  {source.license}
                </ContentLink>
              )}
            </details>
          )}
        </div>
      ))}
      {rejected > 0 && <p role="status">{t('provenance.partial', { count: rejected })}</p>}
    </div>
  );
}
