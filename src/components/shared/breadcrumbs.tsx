import { ChevronRight } from '@components/ui/icons';

import { Link } from '@i18n';

export interface Breadcrumb {
  readonly label: string;
  /** Omitted for the page itself, which is the last one. */
  readonly href?: string;
}

export interface BreadcrumbsProps {
  /** Names the landmark for assistive technology ("You are here"). */
  readonly label: string;
  readonly items: readonly Breadcrumb[];
}

/** Where a page sits and the way back up: each step is an address, the last one is the page itself. */
export function Breadcrumbs({ label, items }: BreadcrumbsProps) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-copy-muted">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-1">
            {index > 0 && <ChevronRight className="size-3.5" aria-hidden="true" />}
            {item.href === undefined ? (
              <span aria-current="page" className="font-medium text-copy">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="rounded-token-sm outline-none hover:text-copy hover:underline focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
