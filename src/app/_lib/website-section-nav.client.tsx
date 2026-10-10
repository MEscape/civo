'use client';

import { Link, usePathname } from '@i18n';

import { cn } from '@lib/utils';

export interface WebsiteSectionLink {
  readonly href: string;
  readonly label: string;
  /** Overview matches its own address only; the others also match what lies below them. */
  readonly isExact?: boolean;
}

export interface WebsiteSectionNavProps {
  readonly label: string;
  readonly links: readonly WebsiteSectionLink[];
  /** The editor owns the whole screen, so the section links are not drawn there. */
  readonly hiddenBelow: string;
}

function isCurrent(pathname: string, { href, isExact = false }: WebsiteSectionLink): boolean {
  return pathname === href || (!isExact && pathname.startsWith(`${href}/`));
}

/**
 * The way between a website's pages: overview, builder, bookings, updates and
 * settings. A Client Component so the current page is marked without the
 * layout reading the request.
 */
export function WebsiteSectionNav({ label, links, hiddenBelow }: WebsiteSectionNavProps) {
  const pathname = usePathname();

  if (pathname.startsWith(`${hiddenBelow}/`)) {
    return null;
  }

  return (
    <nav aria-label={label} className="mb-6 border-b border-border">
      <ul className="-mb-px flex flex-wrap gap-x-6 gap-y-1">
        {links.map((link) => {
          const current = isCurrent(pathname, link);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-block border-b-2 py-2 text-sm font-medium',
                  current
                    ? 'border-primary text-copy'
                    : 'border-transparent text-copy-muted hover:text-copy',
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
