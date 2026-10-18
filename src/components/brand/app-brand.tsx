import { Link } from '@i18n';

import { APP_IDENTITY } from '@lib/config';

import { ArtemisLogo } from './artemis-logo';

export interface AppBrandProps {
  readonly href: string;
  /** "by Artemis Connect", shown beside the name where the bar has room. */
  readonly byline: string;
}

/**
 * The product in the admin bar: the Artemis Connect mark, the product's name
 * and, on wide screens, who makes it. One link, named by the product's name
 * (the mark is decoration beside it).
 */
export function AppBrand({ href, byline }: AppBrandProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-token-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <ArtemisLogo variant="mark" className="h-7 text-primary-copy" />
      <span className="font-heading text-lg font-semibold text-copy">{APP_IDENTITY.name}</span>
      <span className="hidden border-l border-border pl-2.5 text-xs text-copy-muted sm:inline">
        {byline}
      </span>
    </Link>
  );
}
