'use client';

import { useRef } from 'react';

import { isCurrent, useSectionNav } from '@hooks/use-section-nav';
import type { AppNavLink } from '@hooks/use-section-nav';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

import { NavDisclosure } from './nav-disclosure';

export interface SectionNavProps {
  /** Names the landmark for screen readers, e.g. "Website navigation". */
  readonly label: string;
  /** What the single dropdown says on a narrow screen while no section is current. */
  readonly compactLabel?: string | undefined;
  /** The dropdown that holds the tabs the bar has no room for. */
  readonly moreLabel?: string | undefined;
  /** The brand first when there is one, then the tabs; links with a `group` end up in a dropdown of that name. */
  readonly links: readonly AppNavLink[];
  /** `null` while the path is not known yet (the prerendered shell): nothing is marked current. */
  readonly pathname: string | null;
}

const TAB = 'flex items-center whitespace-nowrap border-b-2 text-sm font-medium';
const BRAND =
  'flex min-w-0 max-w-40 items-center whitespace-nowrap border-b-2 border-transparent pr-2 font-heading text-sm font-semibold text-copy sm:max-w-none';
const CURRENT_TAB = 'border-primary text-copy';
const OTHER_TAB = 'border-transparent text-copy-muted hover:text-copy';
/** A measured copy of a dropdown button, whose chevron takes room the label does not. */
const MEASURED_DISCLOSURE = 'gap-1 border-transparent pr-5';

/**
 * The website bar: the brand, then as many tabs as the bar has room for, in
 * order, and one dropdown for the rest. The room is measured, not guessed
 * from the screen width: the website's name and the publish button beside
 * the bar change how much is left. With everything in view, the grouped
 * sections (administration) are their own dropdown; with too little room for
 * even two tabs, one dropdown naming the current section holds them all.
 */
export function SectionNav(props: SectionNavProps) {
  const { label, compactLabel, moreLabel, pathname } = props;
  const areaRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const nav = useSectionNav(props, areaRef, measureRef);
  const asDisclosureLink = (link: AppNavLink) => ({
    href: link.href,
    label: link.label,
    isCurrent: isCurrent(pathname, link),
    isDisabled: link.isDisabled === true,
    hint: link.hint,
  });

  return (
    <nav aria-label={label} className="flex h-full min-w-0 flex-1 items-stretch gap-4">
      {nav.brand.map((link) => (
        <Link key={link.href} href={link.href} title={link.label} className={BRAND}>
          <span className="truncate">{link.label}</span>
        </Link>
      ))}
      <div ref={areaRef} className="relative flex min-w-0 flex-1 items-stretch">
        {/* An invisible copy of every item, measured to decide what fits; clipped, so a narrow
            screen does not scroll sideways because of it. */}
        <div
          aria-hidden="true"
          className="pointer-events-none invisible absolute inset-0 overflow-hidden"
        >
          <ul ref={measureRef} className="flex h-full w-max items-stretch gap-6">
            {nav.tabs.map((link) => (
              <li key={link.href} className={cn(TAB, 'border-transparent')}>
                {link.label}
              </li>
            ))}
            {nav.groupLabel !== undefined && (
              <li className={cn(TAB, MEASURED_DISCLOSURE)}>{nav.groupLabel}</li>
            )}
            <li className={cn(TAB, MEASURED_DISCLOSURE)}>{moreLabel ?? label}</li>
          </ul>
        </div>

        {nav.isCompact ? (
          <NavDisclosure
            label={nav.current?.label ?? compactLabel ?? label}
            isCurrent={nav.current !== undefined}
            links={nav.sections.map(asDisclosureLink)}
          />
        ) : (
          <ul className="flex h-full min-w-0 items-stretch gap-6">
            {nav.shown.map((link) => {
              const isLinkCurrent = isCurrent(pathname, link);
              return (
                <li key={link.href} className="flex">
                  {link.isDisabled === true ? (
                    <span
                      aria-disabled="true"
                      title={link.hint}
                      className={cn(
                        TAB,
                        'cursor-not-allowed border-transparent text-copy-muted/60',
                      )}
                    >
                      {link.label}
                    </span>
                  ) : (
                    <Link
                      href={link.href}
                      aria-current={isLinkCurrent ? 'page' : undefined}
                      className={cn(TAB, isLinkCurrent ? CURRENT_TAB : OTHER_TAB)}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              );
            })}
            {nav.overflowMenu !== false && (
              <li className="flex">
                <NavDisclosure
                  label={nav.overflowMenu.label}
                  isCurrent={nav.overflowMenu.links.some((link) => isCurrent(pathname, link))}
                  links={nav.overflowMenu.links.map(asDisclosureLink)}
                  align="end"
                />
              </li>
            )}
          </ul>
        )}
      </div>
    </nav>
  );
}
