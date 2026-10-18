import { Suspense } from 'react';
import type { ComponentProps } from 'react';

import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { restoreStoredPageConfig } from '@modules/builder';
import { renderPageNodes } from '@modules/component-platform';
import { ReleaseStatusBadge, RestoreReleaseButton, releaseQueries } from '@modules/release';
import type { PreviewFidelityView } from '@modules/release';
import { releaseRoutes } from '@modules/release/client';
import { restoreStoredWebsiteTheme, ThemeProvider } from '@modules/website';

import { AdminContainer, Section } from '@components/layout/layout-primitives';
import { I18nProvider } from '@components/providers/i18n-provider';
import { Breadcrumbs } from '@components/shared/breadcrumbs';
import { LinkTabs } from '@components/shared/link-tabs';
import { PageSkeleton } from '@components/shared/page-skeleton';
import { Alert } from '@components/ui/alert';
import { Badge } from '@components/ui/badge';
import { Button, buttonVariants } from '@components/ui/button';
import { ArrowLeft, ArrowRight } from '@components/ui/icons';

import { Link, requireLocale } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { buildPrivateMetadata } from '@lib/seo';
import { buildQueryString } from '@lib/utils';

import { loadComponentLabels } from '@/app/_lib/component-labels';
import { loadMemberNames } from '@/app/_lib/member-names';
import { orFail } from '@/app/_lib/or-fail';
import { getWebsiteAccess } from '@/app/_lib/website-access';

interface RouteProps {
  readonly params: Promise<{ locale: string; websiteId: string; releaseId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const locale = requireLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: 'release' });
  return buildPrivateMetadata(t('preview.crumbReleases'));
}

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** The page of the release list a person came from; anything else is the first. */
function fromPageOf(raw: string | undefined): number {
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 1 ? value : 1;
}

async function FidelityNotice({
  locale,
  fidelity,
}: {
  readonly locale: Locale;
  readonly fidelity: PreviewFidelityView;
}) {
  if (fidelity.status === 'exact') {
    return null;
  }
  const [t, labels] = await Promise.all([
    getTranslations({ locale, namespace: 'release' }),
    loadComponentLabels(
      locale,
      fidelity.deviations.map((deviation) => deviation.type),
    ),
  ]);
  const isGone = fidelity.status === 'unavailable';

  return (
    <Alert variant={isGone ? 'danger' : 'warning'} role="status">
      <p className="font-heading text-base font-semibold">
        {isGone ? t('preview.fidelity.unavailableTitle') : t('preview.fidelity.changedTitle')}
      </p>
      <p className="mt-1 text-sm text-copy">
        {isGone ? t('preview.fidelity.unavailable') : t('preview.fidelity.changed')}
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {fidelity.deviations.map((deviation) => (
          <li key={deviation.type}>
            <Badge variant={deviation.currentVersion === null ? 'danger' : 'warning'}>
              {deviation.currentVersion === null
                ? t('preview.fidelity.gone', {
                    component: labels[deviation.type] ?? deviation.type,
                    from: deviation.pinnedVersion,
                  })
                : t('preview.fidelity.versionChange', {
                    component: labels[deviation.type] ?? deviation.type,
                    from: deviation.pinnedVersion,
                    to: deviation.currentVersion,
                  })}
            </Badge>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

interface ReleaseRef {
  readonly id: string;
  readonly releaseNumber: number;
}

/** Previous and next release in the history, each a link or, at the end of the history, a disabled button. */
async function NeighbourNav({
  locale,
  websiteId,
  from,
  older,
  newer,
}: {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly from: number;
  readonly older: ReleaseRef | null;
  readonly newer: ReleaseRef | null;
}) {
  const t = await getTranslations({ locale, namespace: 'release' });
  return (
    <nav aria-label={t('preview.navLabel')} className="flex gap-2">
      {older === null ? (
        <Button variant="outline" size="sm" disabled>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t('preview.older')}
        </Button>
      ) : (
        <Link
          href={releaseRoutes.preview(websiteId, older.id, from)}
          aria-label={t('preview.olderLabel', { number: older.releaseNumber })}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {t('preview.older')}
        </Link>
      )}
      {newer === null ? (
        <Button variant="outline" size="sm" disabled>
          {t('preview.newer')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      ) : (
        <Link
          href={releaseRoutes.preview(websiteId, newer.id, from)}
          aria-label={t('preview.newerLabel', { number: newer.releaseNumber })}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          {t('preview.newer')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      )}
    </nav>
  );
}

/** The page asked for by path; with no path asked, the first one. */
function pickPage<T extends { readonly path: string }>(
  pages: readonly T[],
  requested: string | undefined,
): T | undefined {
  return (
    pages.find((candidate) => candidate.path === (requested ?? '')) ??
    (requested === undefined ? pages[0] : undefined)
  );
}

/** What sets a release apart: that it is the live one, and any status other than published. */
function ReleaseBadges({
  isActive,
  status,
  liveLabel,
}: {
  readonly isActive: boolean;
  readonly status: ComponentProps<typeof ReleaseStatusBadge>['status'];
  readonly liveLabel: string;
}) {
  return (
    <>
      {isActive && <Badge variant="success">{liveLabel}</Badge>}
      {status !== 'published' && <ReleaseStatusBadge status={status} />}
    </>
  );
}

/** The frozen page drawn as the public site draws it, or a notice when its stored form cannot be read. */
async function FrozenPage({
  locale,
  restored,
  snapshot,
}: {
  readonly locale: Locale;
  readonly restored: ReturnType<typeof restoreStoredPageConfig>;
  readonly snapshot: {
    readonly theme: Parameters<typeof restoreStoredWebsiteTheme>[0];
    readonly website: { readonly id: string };
  };
}) {
  const t = await getTranslations({ locale, namespace: 'release' });
  return restored.isErr() ? (
    <Alert variant="danger" role="status">
      <p className="font-heading text-base font-semibold">{t('preview.broken.title')}</p>
      <p className="mt-1 text-sm text-copy">{t('preview.broken.description')}</p>
    </Alert>
  ) : (
    <div className="overflow-hidden rounded-token border border-border-strong">
      <ThemeProvider theme={restoreStoredWebsiteTheme(snapshot.theme)} className="min-h-96">
        {renderPageNodes(restored.value.children, {
          mode: 'published',
          websiteId: snapshot.website.id,
        })}
      </ThemeProvider>
    </div>
  );
}

/**
 * One release's pages as they were frozen, for looking at an earlier state or at
 * what is live. It sits under the release list (a way back that keeps the page
 * of the list) and between its neighbours in the history. Read through the
 * authorized website, so another website's release is "not found"; nothing here
 * can be edited. A release that today's components cannot draw as it was says
 * so, and one whose stored page cannot be read says that, instead of failing.
 */
async function PreviewContent({ params, searchParams }: RouteProps) {
  const { locale: rawLocale, websiteId, releaseId } = await params;
  const locale = requireLocale(rawLocale);
  const query = await searchParams;
  const [t, format, access, view] = await Promise.all([
    getTranslations({ locale, namespace: 'release' }),
    getAppFormatters(),
    getWebsiteAccess(),
    orFail(releaseQueries.getReleasePreview.execute(websiteId, releaseId)),
  ]);
  const { release, snapshot, fidelity, older, newer } = view;
  const authors = await loadMemberNames([release.publishedBy]);

  const requested = firstOf(query['path']);
  const page = pickPage(snapshot.pages, requested);
  if (page === undefined) {
    notFound();
  }
  const restored = restoreStoredPageConfig(page.config);

  const from = fromPageOf(firstOf(query['from']));
  const number = release.releaseNumber;
  const when = release.publishedAt ?? release.createdAt;
  const author = release.publishedBy === null ? undefined : authors?.[release.publishedBy];

  return (
    <AdminContainer>
      <Section className="space-y-6 py-8">
        <I18nProvider locale={locale} namespaces={['release']}>
          <div className="space-y-3">
            <Breadcrumbs
              label={t('preview.crumbLabel')}
              items={[
                {
                  label: t('preview.crumbReleases'),
                  href: releaseRoutes.releasesAt(websiteId, from),
                },
                { label: t('history.releaseNumber', { number }) },
              ]}
            />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-heading text-2xl font-semibold text-copy">
                    {t('history.releaseNumber', { number })}
                  </h1>
                  <ReleaseBadges
                    isActive={release.isActive}
                    status={release.status}
                    liveLabel={t('preview.live')}
                  />
                </div>
                {release.note !== null && <p className="text-sm text-copy">{release.note}</p>}
                <p className="text-sm text-copy-muted">
                  {format.dateTime(when)}
                  {release.publishedBy !== null &&
                    authors !== null &&
                    ` · ${author === undefined ? t('history.publishedByFormer') : t('history.publishedBy', { name: author })}`}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <NeighbourNav
                  locale={locale}
                  websiteId={websiteId}
                  from={from}
                  older={older}
                  newer={newer}
                />
                {access.may('release.rollback') && release.canRollback && (
                  <RestoreReleaseButton
                    websiteId={websiteId}
                    releaseId={release.id}
                    releaseNumber={number}
                    publishedAt={when.toISOString()}
                  />
                )}
              </div>
            </div>
          </div>

          <FidelityNotice locale={locale} fidelity={fidelity} />

          <LinkTabs
            label={t('preview.pagesLabel')}
            activeKey={page.path}
            tabs={snapshot.pages.map((candidate) => ({
              key: candidate.path,
              label: candidate.path === '' ? t('preview.home') : candidate.title,
              href: `${releaseRoutes.preview(websiteId, releaseId)}${buildQueryString({
                from: from > 1 ? from : undefined,
                path: candidate.path,
              })}`,
            }))}
          />

          <FrozenPage locale={locale} restored={restored} snapshot={snapshot} />
        </I18nProvider>
      </Section>
    </AdminContainer>
  );
}

export default function ReleasePreviewPage({ params, searchParams }: RouteProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PreviewContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
