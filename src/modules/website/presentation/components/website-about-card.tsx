import type { ReactNode } from 'react';

import { CopyButton } from '@components/shared/copy-button';
import { OverviewCard, OverviewRow } from '@components/shared/overview-card';
import { ExternalLink } from '@components/ui/icons';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import type { WebsiteView } from '../../application/contracts/website-views';

export interface WebsiteAboutCardProps {
  readonly locale: Locale;
  readonly website: WebsiteView;
  /** Where the public site is served; `null` until something is published. */
  readonly publicHref: string | null;
  /** The address visitors type, in full, for the copy button. */
  readonly publicUrl: string | null;
  /** Counts owned by other modules; `null` when the actor may not see them. */
  readonly pageCount: number | null;
  readonly dataSourceCount: number | null;
}

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-copy-muted">{label}</dt>
      <dd className="min-w-0 truncate text-right text-copy">{children}</dd>
    </div>
  );
}

/** The website's own facts: where it is served, how much it holds, when it was made and last changed. */
export async function WebsiteAboutCard({
  locale,
  website,
  publicHref,
  publicUrl,
  pageCount,
  dataSourceCount,
}: WebsiteAboutCardProps) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'website' }),
    getAppFormatters(),
  ]);

  return (
    <OverviewCard title={t('pages.detail.about.title')}>
      <OverviewRow>
        <dl className="space-y-2.5">
          <Fact label={t('pages.detail.about.address')}>
            <span className="inline-flex items-center gap-1">
              {publicHref === null ? (
                <span className="text-copy-muted">/{website.slug}</span>
              ) : (
                <Link
                  href={publicHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-token-sm text-primary-copy outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  /{website.slug}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  <span className="sr-only">{t('pages.detail.viewSite')}</span>
                </Link>
              )}
              {publicUrl !== null && (
                <CopyButton
                  value={publicUrl}
                  label={t('pages.detail.about.copy')}
                  copiedLabel={t('pages.detail.about.copied')}
                />
              )}
            </span>
          </Fact>
          {pageCount !== null && (
            <Fact label={t('pages.detail.about.pages')}>{format.number(pageCount)}</Fact>
          )}
          {dataSourceCount !== null && (
            <Fact label={t('pages.detail.about.dataSources')}>
              {format.number(dataSourceCount)}
            </Fact>
          )}
          <Fact label={t('pages.detail.about.created')}>{format.date(website.createdAt)}</Fact>
          <Fact label={t('pages.detail.about.updated')}>{format.dateTime(website.updatedAt)}</Fact>
        </dl>
      </OverviewRow>
    </OverviewCard>
  );
}
