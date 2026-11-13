'use client';

import { Suspense } from 'react';

import { isCurrent } from '@hooks/use-section-nav';
import type { AppNavLink } from '@hooks/use-section-nav';

import { Link, usePathname } from '@i18n';

import { cn } from '@lib/utils';

import { SectionNav } from './section-nav';

import type { SectionNavProps } from './section-nav';

export interface AppNavProps extends Omit<SectionNavProps, 'pathname' | 'links'> {
  readonly links: readonly AppNavLink[];
  /** `header`: links in the app bar; `section`: the website bar, whose first link may name the website and the rest are tabs between its areas. */
  readonly variant: 'header' | 'section';
}

interface NavListProps extends AppNavProps {
  /** `null` while the path is not known yet (the prerendered shell): nothing is marked current. */
  readonly pathname: string | null;
}

function HeaderNav({ label, links, pathname }: NavListProps) {
  return (
    <nav aria-label={label} className="flex items-center gap-6">
      <ul className="flex items-center gap-6">
        {links.map((link) => {
          const isLinkCurrent = isCurrent(pathname, link);
          return (
            <li key={link.href + link.label}>
              <Link
                href={link.href}
                aria-current={isLinkCurrent ? 'page' : undefined}
                className={cn(
                  link.isBrand === true
                    ? 'font-heading text-lg font-semibold text-copy'
                    : 'text-sm text-copy-muted hover:text-copy',
                  isLinkCurrent && 'text-copy',
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

function NavList(props: NavListProps) {
  return props.variant === 'section' ? <SectionNav {...props} /> : <HeaderNav {...props} />;
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
