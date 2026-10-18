import { Alert } from '@components/ui/alert';
import { buttonVariants } from '@components/ui/button';
import { AlertTriangle, Check, Info } from '@components/ui/icons';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getAppFormatters, getTranslations } from '@i18n/server';

import { releaseRoutes } from '../routes';

import { changeCountOf, settingsChangeKeys } from './change-kinds';
import { PublishButton } from './publish-button';

import type { PublicationStatusView } from '../../application/contracts/release-views';

const TITLES_SHOWN = 3;

export interface PublicationBannerProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly status: PublicationStatusView;
  /** Whether the actor may publish. Without it the banner only reports. */
  readonly mayPublish: boolean;
  /** Whether the actor may check and apply component updates. */
  readonly mayUpdate: boolean;
}

/** The count of component updates waiting, and whether this reader may act on them. */
const updatesWaiting = (status: PublicationStatusView, mayUpdate: boolean) =>
  mayUpdate ? (status.componentUpdates?.available ?? 0) : 0;

/**
 * The first thing the overview says: whether visitors see what the editor
 * shows. One of three states (not published yet, changes waiting, everything
 * live), each with the one thing to do about it.
 */
export function PublicationBanner(props: PublicationBannerProps) {
  const { live, draft } = props.status;
  return live !== null && !draft.hasChanges ? (
    <LiveBanner {...props} live={live} />
  ) : (
    <PendingBanner {...props} />
  );
}

async function LiveBanner({
  locale,
  websiteId,
  status,
  mayUpdate,
  live,
}: PublicationBannerProps & { readonly live: NonNullable<PublicationStatusView['live']> }) {
  const [t, format] = await Promise.all([
    getTranslations({ locale, namespace: 'release' }),
    getAppFormatters(),
  ]);
  const updates = updatesWaiting(status, mayUpdate);

  return (
    <Alert variant="success" role="status">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-2 font-heading text-base font-semibold">
            <Check className="size-4" aria-hidden="true" />
            {t('banner.liveTitle')}
          </p>
          <p className="text-sm text-copy">
            {t('banner.liveDescription', {
              number: live.releaseNumber,
              date: format.dateTime(live.publishedAt ?? live.createdAt),
            })}
          </p>
        </div>
        {updates > 0 && <UpdatesLink locale={locale} websiteId={websiteId} count={updates} />}
      </div>
    </Alert>
  );
}

async function PendingBanner({
  locale,
  websiteId,
  status,
  mayPublish,
  mayUpdate,
}: PublicationBannerProps) {
  const t = await getTranslations({ locale, namespace: 'release' });
  const { live, draft } = status;
  const isBlocked = draft.blockedPageCount > 0;
  const updates = updatesWaiting(status, mayUpdate);
  const names = [
    ...draft.pageChanges.map((change) => change.title),
    ...settingsChangeKeys(draft).map((key) => t(`publication.settings.${key}`)),
  ].slice(0, TITLES_SHOWN);
  const rest = changeCountOf(draft) - names.length;

  return (
    <Alert variant={live === null ? 'info' : 'warning'} role="status">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="font-heading text-base font-semibold">
            {live === null
              ? t('banner.firstTitle')
              : t('banner.changesTitle', { count: Math.max(1, changeCountOf(draft)) })}
          </p>
          <p className="text-sm text-copy">
            {names.length > 0
              ? `${names.join(' · ')}${rest > 0 ? ` · ${t('publication.morePages', { count: rest })}` : ''}`
              : t('banner.firstDescription')}
          </p>
          {isBlocked && (
            <p className="flex items-start gap-1.5 pt-1 text-sm text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t('publication.blocked', { count: draft.blockedPageCount })}
            </p>
          )}
        </div>
        {mayPublish && (
          <PublishButton
            websiteId={websiteId}
            draft={draft}
            nextNumber={status.nextReleaseNumber}
            isFirst={live === null}
            disabled={isBlocked}
          />
        )}
      </div>
      {updates > 0 && (
        <div className="mt-3 border-t border-current/20 pt-3">
          <UpdatesLink locale={locale} websiteId={websiteId} count={updates} />
        </div>
      )}
    </Alert>
  );
}

async function UpdatesLink({
  locale,
  websiteId,
  count,
}: {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly count: number;
}) {
  const t = await getTranslations({ locale, namespace: 'release' });

  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-copy">
      <Info className="size-4 shrink-0" aria-hidden="true" />
      {t('banner.updates', { count })}
      <Link
        href={releaseRoutes.updates(websiteId)}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        {t('banner.updatesReview')}
      </Link>
    </p>
  );
}
