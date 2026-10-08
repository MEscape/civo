'use client';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface AppNavLink {
  readonly href: string;
  readonly label: string;
  /** The first link usually names the app itself and is set larger. */
  readonly isBrand?: boolean;
}

export interface AppNavProps {
  /** Names the landmark for screen readers, e.g. "Main navigation". */
  readonly label: string;
  readonly links: readonly AppNavLink[];
}

/**
 * A header's navigation links. A Client Component on purpose: the locale-aware
 * `Link` reads the locale from context here, while on the server it looks it
 * up from the request, which keeps a layout from prerendering.
 */
export function AppNav({ label, links }: AppNavProps) {
  return (
    <nav aria-label={label} className="flex items-center gap-6">
      {links.map((link) => (
        <Link
          key={link.href + link.label}
          href={link.href}
          className={cn(
            link.isBrand === true
              ? 'font-heading text-lg font-semibold text-copy'
              : 'text-sm text-copy-muted hover:text-copy',
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
