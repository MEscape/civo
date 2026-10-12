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
  /** `header`: links in the app bar; `section`: tabs between the pages of one area. */
  readonly variant: keyof typeof VARIANT_CLASSES;
  /** The editor owns the whole screen: at or below this path no links are drawn. */
  readonly hiddenBelow?: string;
}

const VARIANT_CLASSES = {
  header: {
    nav: 'flex items-center gap-6',
    list: 'flex items-center gap-6',
    link: 'text-sm',
    brand: 'font-heading text-lg font-semibold text-copy',
    current: 'text-copy',
    other: 'text-copy-muted hover:text-copy',
  },
  section: {
    nav: 'mb-6 border-b border-border',
    list: '-mb-px flex flex-wrap gap-x-6 gap-y-1',
    link: 'inline-block border-b-2 py-2 text-sm font-medium',
    brand: 'border-transparent font-heading text-lg font-semibold text-copy',
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
            <li key={link.href + link.label}>
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

function CurrentPathNav({ hiddenBelow, ...rest }: AppNavProps) {
  const pathname = usePathname();

  if (hiddenBelow !== undefined && pathname.startsWith(`${hiddenBelow}/`)) {
    return null;
  }
  return <NavList {...rest} pathname={pathname} />;
}

/**
 * The app's navigation links, in the header or as the tabs between a
 * website's pages, with the current page marked. A Client Component on
 * purpose: the locale-aware `Link` and the current path come from context
 * here, while on the server they come from the request, which keeps a layout
 * from prerendering. The path is runtime data, so the links first render
 * unmarked as the prerendered shell; where the links may be hidden by the
 * path (`hiddenBelow`), the shell shows none rather than flash them.
 */
export function AppNav(props: AppNavProps) {
  const { hiddenBelow, ...rest } = props;
  const shell = hiddenBelow === undefined ? <NavList {...rest} pathname={null} /> : null;

  return (
    <Suspense fallback={shell}>
      <CurrentPathNav {...props} />
    </Suspense>
  );
}
