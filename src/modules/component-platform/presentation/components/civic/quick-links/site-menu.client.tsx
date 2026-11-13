'use client';

import { ChevronDown } from '@components/icons/icons';
import { Container } from '@components/layout/layout-primitives';
import { buttonVariants } from '@components/ui/button';
import { ContentLink } from '@components/ui/content-link';

import { I18N_ROUTING, usePathname } from '@i18n';

import { cn } from '@lib/utils';

interface SiteMenuProps {
  readonly links: ReadonlyArray<{ readonly label: string; readonly href: string }>;
  readonly label: string;
  readonly menuLabel: string;
}

function MenuLinks({
  links,
  vertical = false,
}: {
  readonly links: SiteMenuProps['links'];
  readonly vertical?: boolean;
}) {
  const pathname = usePathname();
  return (
    <ul className={cn('flex', vertical ? 'flex-col' : 'flex-wrap justify-end gap-x-6')}>
      {links.map((link) => (
        <li key={link.href}>
          <ContentLink
            href={link.href}
            aria-current={
              I18N_ROUTING.locales.some((locale) => link.href === `/${locale}${pathname}`) ||
              pathname === link.href
                ? 'page'
                : undefined
            }
            className={cn(
              'flex min-h-11 items-center text-sm font-medium text-copy hover:text-primary-copy aria-[current=page]:border-primary aria-[current=page]:text-primary-copy [overflow-wrap:anywhere]',
              // A bar beside the row in the list, under the word in the bar: the current page is not marked by colour alone.
              vertical
                ? 'border-l-2 border-transparent px-3 hover:bg-canvas aria-[current=page]:bg-canvas'
                : 'border-b-2 border-transparent not-aria-[current=page]:hover:border-border',
            )}
          >
            {link.label}
          </ContentLink>
        </li>
      ))}
    </ul>
  );
}

/** Native disclosure keeps mobile navigation keyboard accessible without a modal or a delayed menu mount. */
export function SiteMenu({ links, label, menuLabel }: SiteMenuProps) {
  return (
    <nav aria-label={label} className="shrink-0 lg:min-w-0 lg:shrink">
      <div className="hidden lg:block">
        <MenuLinks links={links} />
      </div>
      {/* The panel hangs from the (relative) header so the toggle can sit beside the brand. */}
      <details className="group lg:hidden">
        <summary
          className={cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'h-11 cursor-pointer list-none group-open:bg-canvas [&::-webkit-details-marker]:hidden',
          )}
        >
          {menuLabel}
          <ChevronDown
            className="transition-transform group-open:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </summary>
        <div className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface py-2 shadow-lg">
          <Container>
            <MenuLinks links={links} vertical />
          </Container>
        </div>
      </details>
    </nav>
  );
}
