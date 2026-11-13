'use client';

import { Suspense } from 'react';

import { SectionNav } from '@components/layout/section-nav';

import type { AppNavLink } from '@hooks/use-section-nav';

import { usePathname } from '@i18n';

import { LOCATION_SLOT, whereInWorkspace } from '../../forms/workspace-nav';

import type { WorkspaceLink } from '../../forms/workspace-nav';

export interface BookingNavProps {
  readonly label: string;
  readonly moreLabel: string;
  readonly links: readonly WorkspaceLink[];
  /** Why a switched-off area is: it needs a location first. */
  readonly lockedHint: string;
}

function itemsOf({ links, lockedHint }: BookingNavProps, pathname: string | null): AppNavLink[] {
  const { area, locationId } = whereInWorkspace(pathname);
  return links.map((link) => ({
    href:
      locationId !== undefined && link.locationHref !== undefined
        ? link.locationHref.replace(LOCATION_SLOT, locationId)
        : link.href,
    label: link.label,
    isActive: link.area === area,
    ...(link.isDisabled === true ? { isDisabled: true, hint: lockedHint } : {}),
    ...(link.group === undefined ? {} : { group: link.group }),
  }));
}

function Nav(props: BookingNavProps & { readonly pathname: string | null }) {
  return (
    <SectionNav
      label={props.label}
      moreLabel={props.moreLabel}
      pathname={props.pathname}
      links={itemsOf(props, props.pathname)}
    />
  );
}

function CurrentPathNav(props: BookingNavProps) {
  return <Nav {...props} pathname={usePathname()} />;
}

/**
 * The workspace bar's tabs. The areas that belong to a location (services, resources, the team) open
 * on the location the person is looking at, so moving between them never asks again; the current
 * address decides which tab is current, since a location's services sit below the locations.
 */
export function BookingNav(props: BookingNavProps) {
  return (
    <Suspense fallback={<Nav {...props} pathname={null} />}>
      <CurrentPathNav {...props} />
    </Suspense>
  );
}
