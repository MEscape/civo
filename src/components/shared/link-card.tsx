import type { ReactNode } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '@components/ui/card';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface LinkCardProps {
  readonly href: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly className?: string;
}

/**
 * A card that is one link. The title is the link (so the accessible name is
 * the title, not the whole card's text) and its `::after` stretches over the
 * card: the whole surface is clickable and there is a single tab stop.
 * `Link` is the locale-aware one.
 */
export function LinkCard({ href, title, description, className }: LinkCardProps) {
  return (
    <Card
      className={cn(
        'relative h-full transition-colors hover:border-primary has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-accent',
        className,
      )}
    >
      <CardHeader>
        <CardTitle>
          <Link
            href={href}
            className="after:absolute after:inset-0 after:rounded-token focus-visible:outline-none"
          >
            {title}
          </Link>
        </CardTitle>
        {description !== undefined && <CardDescription>{description}</CardDescription>}
      </CardHeader>
    </Card>
  );
}
