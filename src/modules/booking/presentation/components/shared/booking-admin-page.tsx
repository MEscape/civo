import type { ReactNode } from 'react';

import { AdminPage, AdminPageHeader } from '@components/layout/admin-page';
import { I18nProvider } from '@components/providers/i18n-provider';
import { UnsavedChangesProvider } from '@components/providers/unsaved-changes-provider';

import type { Locale } from '@i18n';

import { getTranslations } from '@i18n/server';

import { orNull } from '@lib/errors/or-null';

import { getBookingQueries } from '../../../composition';
import { BookingWebsiteProvider } from '../../hooks/use-booking-website';

import { FreshOnReturn } from './fresh-on-return';
import { AREA_ENTRY_ROUTES, AREA_LIST_ROUTES, LocationScope } from './location-scope';

import type { LocationArea } from './area-location-picker';
import type { BookingTranslator } from '../../translation/translator';

/** One step of the way back to the parent pages; the last has no address, it is where the person is. */
export interface BookingCrumb {
  readonly label: string;
  readonly href?: string;
}

/** Which location's services, resources or team a page belongs to: the way back up from it is made from this. */
export interface BookingScope {
  readonly area: LocationArea;
  readonly locationId: string;
  /** The location's name when the page has it; otherwise it is read from the workspace's locations. */
  readonly locationName?: string;
  /** The area's list at this location with its filters kept: where the parent crumb leads. */
  readonly listHref?: string;
  /** The page is that list itself: it gets the switch between locations, and its own crumb is the location. */
  readonly isList?: boolean;
}

interface ScopeTrailInput {
  readonly scope: BookingScope;
  readonly websiteId: string;
  readonly areaLabel: string;
  /** The workspace's locations: the switch between them, and the name of the one the page is about. */
  readonly choices: ReadonlyArray<{ readonly id: string; readonly name: string }>;
}

/**
 * From the area down to the location. With several locations the area is where one is chosen, so the
 * way back from a location's page leads there; with one the area is that location's list itself.
 */
function scopeTrail({ scope, websiteId, areaLabel, choices }: ScopeTrailInput): BookingCrumb[] {
  const { area, locationId, isList = false } = scope;
  const listHref = scope.listHref ?? AREA_LIST_ROUTES[area](websiteId, locationId);
  const name = scope.locationName ?? choices.find(({ id }) => id === locationId)?.name;
  if (choices.length >= 2 && name !== undefined) {
    return [
      { label: areaLabel, href: AREA_ENTRY_ROUTES[area](websiteId) },
      isList ? { label: name } : { label: name, href: listHref },
    ];
  }
  return isList ? [] : [{ label: areaLabel, href: listHref }];
}

interface ScopeFrameInput {
  readonly scope: BookingScope | undefined;
  readonly websiteId: string;
  readonly t: BookingTranslator;
  readonly crumbs: readonly BookingCrumb[];
}

/**
 * What a page of one location's area gets from its `scope`: the trail down to it (before the page's own
 * crumbs) and, on the list itself, the switch between locations. A page without a scope has neither.
 */
async function scopeFrame({ scope, websiteId, t, crumbs }: ScopeFrameInput) {
  if (scope === undefined) {
    return { trail: crumbs, switcher: undefined };
  }
  const setup = await orNull(getBookingQueries().getBookingSetup.execute({ websiteId }));
  const choices = setup?.locationChoices ?? [];
  const trail = [
    ...scopeTrail({ scope, websiteId, areaLabel: t(`area.${scope.area}`), choices }),
    ...crumbs,
  ];
  const switcher = scope.isList === true && (
    <LocationScope
      websiteId={websiteId}
      locationId={scope.locationId}
      area={scope.area}
      choices={choices}
      label={t('workspace.workingAt')}
      allLabel={t('area.allLocations')}
    />
  );
  return { trail, switcher: switcher === false ? undefined : switcher };
}

export interface BookingAdminPageProps {
  readonly locale: Locale;
  /** The website the page belongs to: every control on it names this website when it calls the server. */
  readonly websiteId: string;
  readonly title: string;
  readonly description?: string | undefined;
  /** The page's main action (a "create" button), at the heading's far edge; it wraps below on a narrow screen. */
  readonly actions?: ReactNode;
  /** Where the page sits below its parent, above the title: only on a page that has a parent to return to. With a `scope`, the steps from the area down to the location come first. */
  readonly crumbs?: readonly BookingCrumb[];
  /** A page of one location's services, resources or team. */
  readonly scope?: BookingScope;
  /** Facts or context under the lead: the location a page is about, a status. */
  readonly meta?: ReactNode;
  /** A page with a form: what the person is told when they leave it with unsaved changes. */
  readonly unsavedBody?: string;
  readonly children: ReactNode;
}

/**
 * The frame of every booking administration page: the admin column, the breadcrumbs, the page's
 * single `h1` with its description and main action, and the sections below. It also provides what the controls below need: the translations of the module, the
 * website, and (on a form page) one guard for unsaved changes. The way between the areas is the workspace bar of the layout.
 */
export async function BookingAdminPage({
  locale,
  websiteId,
  title,
  description,
  actions,
  crumbs,
  scope,
  meta,
  unsavedBody,
  children,
}: BookingAdminPageProps) {
  const t = await getTranslations({ locale, namespace: 'booking' });
  const { trail, switcher } = await scopeFrame({ scope, websiteId, t, crumbs: crumbs ?? [] });
  // The provider sits around the whole frame: the heading's main action (a create button) calls the server too.
  return (
    <BookingWebsiteProvider websiteId={websiteId}>
      {/* Coming back to a page (the create form, say) starts it over: nothing typed the last time is still in it. */}
      <FreshOnReturn>
        <AdminPage>
          <AdminPageHeader
            title={title}
            description={description}
            crumbs={trail}
            meta={meta ?? switcher}
            breadcrumbLabel={t('area.breadcrumb')}
            actions={
              actions === undefined ? undefined : (
                <I18nProvider locale={locale} namespaces={['booking']}>
                  {actions}
                </I18nProvider>
              )
            }
          />
          <I18nProvider locale={locale} namespaces={['booking']}>
            {unsavedBody === undefined ? (
              children
            ) : (
              <UnsavedChangesProvider
                title={t('form.unsavedTitle')}
                description={unsavedBody}
                confirmLabel={t('form.unsavedConfirm')}
                cancelLabel={t('form.unsavedCancel')}
              >
                {children}
              </UnsavedChangesProvider>
            )}
          </I18nProvider>
        </AdminPage>
      </FreshOnReturn>
    </BookingWebsiteProvider>
  );
}
