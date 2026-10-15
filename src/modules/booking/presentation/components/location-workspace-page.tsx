import { notFound } from 'next/navigation';

import { I18nProvider } from '@components/providers/i18n-provider';

import type { Locale } from '@i18n';

import type { AppError } from '@lib/errors';
import { escalate } from '@lib/errors/escalate';

import { bookingAdminQueries } from '../../composition';
import { toBookingOptionsDto, toLocationWorkspaceDto } from '../dto/setup-dto';

import { LocationWorkspace } from './setup/location-workspace.client';
import { BookingUnsavedGuard } from './shared/booking-unsaved-guard';

export interface LocationWorkspacePageProps {
  readonly websiteId: string;
  readonly locationId: string;
  /** The URL's locale: a page prerenders on its own, so it must not be read from the request. */
  readonly locale: Locale;
}

/** What a person who may not see this location, or asked for one that is not there, is told: it is not there. */
const NOT_FOUND_KINDS: ReadonlySet<AppError['kind']> = new Set([
  'forbidden',
  'unauthorized',
  'validation',
  'not_found',
]);

function failOrNotFound(error: AppError): never {
  if (NOT_FOUND_KINDS.has(error.kind)) {
    notFound();
  }
  escalate(error);
}

/**
 * The workspace of one location. The location must belong to the website in the
 * address: an id of another website's location is the same "not found" as one
 * that does not exist, so the address cannot be used to read across websites.
 */
export async function LocationWorkspacePage({
  websiteId,
  locationId,
  locale,
}: LocationWorkspacePageProps) {
  const access = await bookingAdminQueries.getBookingAccess.execute();
  if (access.isErr()) {
    failOrNotFound(access.error);
  }
  const [workspace, options] = await Promise.all([
    bookingAdminQueries.getLocationWorkspace.execute(locationId),
    bookingAdminQueries.getBookingOptions.execute(websiteId),
  ]);
  if (workspace.isErr()) {
    failOrNotFound(workspace.error);
  }
  if (options.isErr()) {
    failOrNotFound(options.error);
  }
  if (workspace.value.location.websiteId !== websiteId) {
    notFound();
  }

  return (
    <I18nProvider locale={locale} namespaces={['booking']}>
      <BookingUnsavedGuard>
        <LocationWorkspace
          workspace={toLocationWorkspaceDto(workspace.value)}
          options={toBookingOptionsDto(options.value)}
          canConfigure={access.value.canConfigure}
        />
      </BookingUnsavedGuard>
    </I18nProvider>
  );
}
