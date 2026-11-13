import { ArrowLeft } from '@components/icons/icons';

import { Link } from '@i18n';
import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orNull } from '@lib/errors/or-null';

import { getBookingQueries } from '../../../composition';
import { workspaceLinks } from '../../forms/workspace-nav';
import { loadOwnPlaces } from '../../loaders/load-employee-administration';
import { loadOpenBookings } from '../../loaders/load-open-bookings';

import { BookingNav } from './booking-nav.client';
import { WorkspaceSwitcher } from './workspace-switcher.client';

import type { SwitchableWorkspace } from './workspace-switcher.client';
import type { BookingMay } from '../../loaders/booking-readers';

export interface BookingWorkspaceNavProps {
  readonly locale: Locale;
  readonly websiteId: string;
  readonly websiteName: string;
  /** Where the website's administration is; absent for someone who may not open the website. */
  readonly websiteHref?: string | undefined;
  /** The workspaces the person can switch to. */
  readonly workspaces: readonly SwitchableWorkspace[];
  readonly isWorkspacesTruncated: boolean;
  readonly may: BookingMay;
}

/** What a read answered, or `fallback` when it was not made or failed: a bar never fails for a number it cannot show. */
function okOr<T, F>(
  result: { isOk: () => boolean; value?: T } | null,
  read: (value: T) => F,
  fallback: F,
): F {
  return result?.isOk() === true ? read(result.value as T) : fallback;
}

/** What the bar offers this person: the translator, the tabs and where the name leads. */
async function readBar({ locale, websiteId, may }: BookingWorkspaceNavProps) {
  const [mayManage, mayServe, mayClaim] = [
    may('booking.read'),
    may('booking.read.own'),
    may('booking.claim.own'),
  ];
  const queries = getBookingQueries();
  const mayProfile = may('booking.profile.own');
  const [t, setup, open, unread, own] = await Promise.all([
    getTranslations({ locale, namespace: 'booking' }),
    mayManage ? orNull(queries.getBookingSetup.execute({ websiteId })) : null,
    mayServe && mayClaim ? loadOpenBookings(queries, websiteId) : null,
    mayServe ? queries.countUnreadMessages.execute({ websiteId }) : null,
    mayServe && mayProfile ? loadOwnPlaces(websiteId, queries) : null,
  ]);
  const links = workspaceLinks({
    t,
    websiteId,
    mayManage,
    mayConfigure: may('booking.configure'),
    mayServe,
    mayClaim,
    mayProfile,
    // Unknown (no right to look, or the read failed) counts as "has none": a manager's own work shows only once it is known.
    hasCalendar: own !== null,
    hasLocation: setup === null || setup.locations > 0,
    openCount: okOr(open, (offers) => offers.length, 0),
    unreadCount: okOr(unread, (count) => count, 0),
  });
  return { t, links };
}

/**
 * The contents of the workspace's bar: its name, one tab per area, and the way back to the website.
 * What the person may use decides the tabs (display only, every screen authorizes for itself), and
 * the areas that need a location are shown but switched off until the first one exists.
 */
export async function BookingWorkspaceNav(props: BookingWorkspaceNavProps) {
  const { t, links } = await readBar(props);

  return (
    <>
      <WorkspaceSwitcher
        current={{ id: props.websiteId, name: props.websiteName }}
        workspaces={props.workspaces}
        isTruncated={props.isWorkspacesTruncated}
        labels={{
          switch: t('workspace.switch'),
          all: t('workspace.allWorkspaces'),
          truncated: t('workspace.truncated'),
        }}
      />
      <BookingNav
        label={t('area.label')}
        moreLabel={t('workspace.more')}
        links={links}
        lockedHint={t('workspace.locked')}
      />
      {props.websiteHref !== undefined && (
        <Link
          href={props.websiteHref}
          aria-label={t('workspace.websiteNamed', { name: props.websiteName })}
          title={t('workspace.websiteNamed', { name: props.websiteName })}
          className="ms-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-token-sm ps-4 text-sm font-medium text-copy-muted outline-none hover:text-copy focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('workspace.website')}</span>
        </Link>
      )}
    </>
  );
}
