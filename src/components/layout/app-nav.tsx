'use client';

import { Suspense, useLayoutEffect, useRef, useState } from 'react';

import { Link, usePathname } from '@i18n';

import { cn } from '@lib/utils';

import { fitTabs } from './fit-tabs';
import { NavDisclosure } from './nav-disclosure';

export interface AppNavLink {
  readonly href: string;
  readonly label: string;
  /** The first link usually names the app itself and is set larger. It is never marked current. */
  readonly isBrand?: boolean;
  /** Matches its own address only; by default a link is also current for what lies below it. */
  readonly isExact?: boolean;
  /** `section` only: the name of a dropdown the link sits in, after the tabs (e.g. administration). */
  readonly group?: string;
}

export interface AppNavProps {
  /** Names the landmark for screen readers, e.g. "Main navigation". */
  readonly label: string;
  /** `section` only: what the single dropdown says on a narrow screen while no section is current. */
  readonly compactLabel?: string;
  /** `section` only: the dropdown that holds the tabs the bar has no room for. */
  readonly moreLabel?: string;
  readonly links: readonly AppNavLink[];
  /** `header`: links in the app bar; `section`: the website bar, whose first link may name the website and the rest are tabs between its areas. */
  readonly variant: keyof typeof VARIANT_CLASSES;
}

const VARIANT_CLASSES = {
  header: {
    nav: 'flex items-center gap-6',
    list: 'flex items-center gap-6',
    item: '',
    link: 'text-sm',
    brand: 'font-heading text-lg font-semibold text-copy',
    current: 'text-copy',
    other: 'text-copy-muted hover:text-copy',
  },
  section: {
    nav: 'h-full min-w-0',
    list: 'flex h-full items-stretch gap-6 overflow-x-auto',
    item: 'flex',
    link: 'flex items-center whitespace-nowrap border-b-2 text-sm font-medium',
    brand:
      'flex items-center whitespace-nowrap border-b-2 border-transparent pr-2 font-heading text-sm font-semibold text-copy',
    current: 'border-primary text-copy',
    other: 'border-transparent text-copy-muted hover:text-copy',
  },
} as const;

function isCurrent(
  pathname: string | null,
  { href, isBrand = false, isExact = false }: AppNavLink,
) {
  return (
    pathname !== null &&
    !isBrand &&
    (pathname === href || (!isExact && pathname.startsWith(`${href}/`)))
  );
}

type NavListProps = Pick<
  AppNavProps,
  'label' | 'compactLabel' | 'moreLabel' | 'links' | 'variant'
> & {
  /** `null` while the path is not known yet (the prerendered shell): nothing is marked current. */
  readonly pathname: string | null;
};

/** Two tabs beside "more" are still a tab bar; fewer, and one dropdown naming the current section says more. */
const MIN_VISIBLE_TABS = 2;
/** `gap-6`, the space between the bar's items. */
const TAB_GAP_PX = 24;

/**
 * The website bar: the brand, then as many tabs as the bar has room for, in
 * order, and one dropdown for the rest. The room is measured, not guessed
 * from the screen width: the website's name and the publish button beside
 * the bar change how much is left. With everything in view, the grouped
 * sections (administration) are their own dropdown; with too little room for
 * even two tabs, one dropdown naming the current section holds them all.
 */
function SectionNavList({ label, compactLabel, moreLabel, links, pathname }: NavListProps) {
  const classes = VARIANT_CLASSES.section;
  const brand = links.filter((link) => link.isBrand === true);
  const sections = links.filter((link) => link.isBrand !== true);
  const asDisclosureLink = (link: AppNavLink) => ({
    href: link.href,
    label: link.label,
    isCurrent: isCurrent(pathname, link),
  });
  const tabs = sections.filter((link) => link.group === undefined);
  const grouped = sections.filter((link) => link.group !== undefined);
  const groupLabel = grouped[0]?.group;
  const current = sections.find((link) => isCurrent(pathname, link));

  const areaRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);

  useLayoutEffect(() => {
    const area = areaRef.current;
    const measure = measureRef.current;
    if (area === null || measure === null) {
      return undefined;
    }
    // The observer reports once right away, then on every change of the room.
    const observer = new ResizeObserver(() => {
      const widths = [...measure.children].map((item) => (item as HTMLElement).offsetWidth);
      const more = widths.pop() ?? 0;
      const group = groupLabel === undefined ? 0 : (widths.pop() ?? 0);
      setVisibleCount(fitTabs(area.clientWidth, { tabs: widths, gap: TAB_GAP_PX, group, more }));
    });
    observer.observe(area);
    return () => {
      observer.disconnect();
    };
  }, [tabs.length, groupLabel]);

  const isCompact = visibleCount < Math.min(MIN_VISIBLE_TABS, tabs.length);
  const shown = tabs.slice(0, visibleCount);
  const overflow = [...tabs.slice(visibleCount), ...grouped];
  const overflowMenu =
    visibleCount === tabs.length
      ? groupLabel !== undefined && { label: groupLabel, links: grouped }
      : { label: moreLabel ?? label, links: overflow };

  return (
    <nav aria-label={label} className="flex h-full min-w-0 flex-1 items-stretch gap-4">
      {brand.map((link) => (
        <Link key={link.href} href={link.href} className={classes.brand}>
          {link.label}
        </Link>
      ))}
      <div ref={areaRef} className="relative flex min-w-0 flex-1 items-stretch">
        {/* An invisible copy of every item, measured to decide what fits. */}
        <ul
          ref={measureRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute flex h-full items-stretch gap-6"
        >
          {tabs.map((link) => (
            <li key={link.href} className={cn(classes.link, 'border-transparent')}>
              {link.label}
            </li>
          ))}
          {groupLabel !== undefined && (
            <li className={cn(classes.link, 'gap-1 border-transparent pr-5')}>{groupLabel}</li>
          )}
          <li className={cn(classes.link, 'gap-1 border-transparent pr-5')}>
            {moreLabel ?? label}
          </li>
        </ul>

        {isCompact ? (
          <NavDisclosure
            label={current?.label ?? compactLabel ?? label}
            isCurrent={current !== undefined}
            links={sections.map(asDisclosureLink)}
          />
        ) : (
          <ul className="flex h-full min-w-0 items-stretch gap-6">
            {shown.map((link) => {
              const isLinkCurrent = isCurrent(pathname, link);
              return (
                <li key={link.href} className={classes.item}>
                  <Link
                    href={link.href}
                    aria-current={isLinkCurrent ? 'page' : undefined}
                    className={cn(classes.link, isLinkCurrent ? classes.current : classes.other)}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
            {overflowMenu !== false && (
              <li className={classes.item}>
                <NavDisclosure
                  label={overflowMenu.label}
                  isCurrent={overflowMenu.links.some((link) => isCurrent(pathname, link))}
                  links={overflowMenu.links.map(asDisclosureLink)}
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

function NavList(props: NavListProps) {
  const { label, links, variant, pathname } = props;
  if (variant === 'section') {
    return <SectionNavList {...props} />;
  }
  const classes = VARIANT_CLASSES[variant];

  return (
    <nav aria-label={label} className={classes.nav}>
      <ul className={classes.list}>
        {links.map((link) => {
          const current = isCurrent(pathname, link);
          return (
            <li key={link.href + link.label} className={classes.item}>
              <Link
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  link.isBrand === true ? classes.brand : [classes.link, classes.other],
                  current && classes.current,
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function CurrentPathNav(props: AppNavProps) {
  return <NavList {...props} pathname={usePathname()} />;
}

/**
 * The app's navigation links, in the header or as the website bar's tabs,
 * with the current page marked. A Client Component on purpose: the
 * locale-aware `Link` and the current path come from context here, while on
 * the server they come from the request, which keeps a layout from
 * prerendering. The path is runtime data, so the links first render unmarked
 * as the prerendered shell.
 */
export function AppNav(props: AppNavProps) {
  return (
    <Suspense fallback={<NavList {...props} pathname={null} />}>
      <CurrentPathNav {...props} />
    </Suspense>
  );
}
