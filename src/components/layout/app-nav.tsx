'use client';

import { Suspense } from 'react';

import { Link, usePathname } from '@i18n';

import { cn } from '@lib/utils';

export interface AppNavLink {
  readonly href: string;
  readonly label: string;
  /** The first link usually names the app itself and is set larger. It is never marked current. */
  readonly isBrand?: boolean;
  /** Matches its own address only; by default a link is also current for what lies below it. */
  readonly isExact?: boolean;
}

export interface AppNavProps {
  /** Names the landmark for screen readers, e.g. "Main navigation". */
  readonly label: string;
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

type NavListProps = Pick<AppNavProps, 'label' | 'links' | 'variant'> & {
  /** `null` while the path is not known yet (the prerendered shell): nothing is marked current. */
  readonly pathname: string | null;
};

function NavList({ label, links, variant, pathname }: NavListProps) {
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
