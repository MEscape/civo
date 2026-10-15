import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';
import { LinkTabs } from '@components/shared/link-tabs';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import type { AppError } from '@lib/errors';
import { escalate } from '@lib/errors/escalate';

import { bookingAdminQueries } from '../../composition';
import { toBookingOptionsDto, toLocationSummaryDto, toTeamDto } from '../dto/setup-dto';
import { bookingRoutes } from '../routes';

import { OperationsCalendar } from './admin/operations-calendar.client';
import { EmployeeBookings } from './employee-bookings';
import { SetupOverview } from './setup/setup-overview.client';
import { BookingUnsavedGuard } from './shared/booking-unsaved-guard';
import { TeamPanel } from './team/team-panel.client';

export type BookingSearchParams = Readonly<Record<string, string | string[] | undefined>>;

export interface BookingAdministrationProps {
  readonly websiteId: string;
  /** The URL's locale: a page prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
  /** `tab`: the address carries what is shown. */
  readonly searchParams: BookingSearchParams;
}

const TABS = ['calendar', 'team', 'setup'] as const;
type TabKey = (typeof TABS)[number];

/** What a person who may not see this page, or asked for nothing valid, is told: it is not there. */
const NOT_FOUND_KINDS: ReadonlySet<AppError['kind']> = new Set([
  'forbidden',
  'unauthorized',
  'validation',
]);

function failOrNotFound(error: AppError): never {
  if (NOT_FOUND_KINDS.has(error.kind)) {
    notFound();
  }
  escalate(error);
}

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function tabOf(raw: string | undefined): TabKey {
  return TABS.find((tab) => tab === raw) ?? 'calendar';
}

/**
 * The booking screen: the operations calendar first, because that is what
 * staff open it for, then the setup, which is the locations and, inside each,
 * everything that belongs to it. The address says which part is shown
 * (`?tab=`); only that part is read. A person without `booking.read` gets
 * "not found", the same answer as for a website that does not exist; anything
 * unexpected reaches the route's error boundary.
 */
export async function BookingAdministration({
  websiteId,
  locale,
  searchParams,
}: BookingAdministrationProps) {
  const access = await bookingAdminQueries.getBookingAccess.execute();
  if (access.isErr()) {
    failOrNotFound(access.error);
  }
  // An employee has no part in the configuration: they get their own place and nothing else.
  if (access.value.isOwnOnly) {
    return (
      <EmployeeBookings websiteId={websiteId} locale={locale} tab={firstOf(searchParams['tab'])} />
    );
  }

  const tab = tabOf(firstOf(searchParams['tab']));
  const [options, t] = await Promise.all([
    bookingAdminQueries.getBookingOptions.execute(websiteId),
    getTranslations({ locale, namespace: 'booking' }),
  ]);
  if (options.isErr()) {
    failOrNotFound(options.error);
  }
  const optionsDto = toBookingOptionsDto(options.value);
  const { canConfigure, canManage } = access.value;

  async function body() {
    switch (tab) {
      case 'calendar':
        return (
          <OperationsCalendar websiteId={websiteId} options={optionsDto} canManage={canManage} />
        );
      case 'team': {
        const team = await bookingAdminQueries.getTeam.execute(websiteId);
        if (team.isErr()) {
          return failOrNotFound(team.error);
        }
        return <TeamPanel websiteId={websiteId} team={toTeamDto(team.value)} />;
      }
      case 'setup': {
        const overview = await bookingAdminQueries.getSetupOverview.execute(websiteId);
        if (overview.isErr()) {
          return failOrNotFound(overview.error);
        }
        return (
          <SetupOverview
            websiteId={websiteId}
            locations={overview.value.locations.map(toLocationSummaryDto)}
            canConfigure={canConfigure}
          />
        );
      }
    }
  }

  return (
    <I18nProvider locale={locale} namespaces={['booking']}>
      <BookingUnsavedGuard>
        <div className="space-y-6">
          <LinkTabs
            label={t('admin.tabsLabel')}
            activeKey={tab}
            tabs={TABS.filter((key) => key !== 'team' || canManage).map((key) => ({
              key,
              label: t(`admin.tabs.${key}`),
              href: `${bookingRoutes.admin(websiteId)}?tab=${key}`,
            }))}
          />
          {await body()}
        </div>
      </BookingUnsavedGuard>
    </I18nProvider>
  );
}
