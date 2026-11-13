import type { ComponentProps } from 'react';

import { Slot } from '@radix-ui/react-slot';

import { ChevronRight } from '@components/icons/icons';

import { cn } from '@lib/utils';

/**
 * Breadcrumb: the shadcn composition (`Breadcrumb` > `BreadcrumbList` > `BreadcrumbItem` >
 * `BreadcrumbLink` / `BreadcrumbPage`, with a `BreadcrumbSeparator` between items) mapped to
 * Civo design tokens. The landmark needs a name: pass `aria-label`. The current item is
 * `BreadcrumbPage`, which marks itself `aria-current="page"`; a link that selects instead of
 * navigating (a node in a tree) may be a button through `asChild`.
 */
function Breadcrumb(props: ComponentProps<'nav'>) {
  return <nav data-slot="breadcrumb" {...props} />;
}

function BreadcrumbList({ className, ...props }: ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-1.5 text-sm break-words text-copy-muted',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex min-w-0 items-center gap-1.5', className)}
      {...props}
    />
  );
}

interface BreadcrumbLinkProps extends ComponentProps<'a'> {
  readonly asChild?: boolean;
}

function BreadcrumbLink({ asChild = false, className, ...props }: BreadcrumbLinkProps) {
  const Component = asChild ? Slot : 'a';
  return (
    <Component
      data-slot="breadcrumb-link"
      className={cn(
        'rounded-token-sm transition-colors outline-none hover:text-copy hover:underline focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none',
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbPage({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      aria-current="page"
      className={cn('min-w-0 truncate font-medium text-copy', className)}
      {...props}
    />
  );
}

function BreadcrumbSeparator({ children, className, ...props }: ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('text-copy-muted [&>svg]:size-3.5 rtl:[&>svg]:rotate-180', className)}
      {...props}
    >
      {children ?? <ChevronRight />}
    </li>
  );
}

export {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
};
