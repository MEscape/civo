import { Container, PageHeading, Section } from '@components/layout/layout-primitives';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface NotFoundPanelProps {
  readonly title: string;
  readonly description: string;
  /**
   * Where to go next. Omit it when no destination is certain: a 404 never
   * guesses a page (a published site's visitor must not be sent to the
   * platform, and the platform root is not a page).
   */
  readonly action?: { readonly href: string; readonly label: string };
}

/**
 * The body of every 404 page. Each route group supplies its own text and, when
 * it has a safe destination, one way onward; the layout lives here once.
 * `Link` is the locale-aware one, so the way onward keeps the visitor's language.
 */
export function NotFoundPanel({ title, description, action }: NotFoundPanelProps) {
  return (
    <Container className="max-w-md">
      <Section className="space-y-8 text-center">
        <PageHeading title={title} description={description} />
        {action !== undefined && (
          <Link href={action.href} className={cn(buttonVariants(), 'w-full')}>
            {action.label}
          </Link>
        )}
      </Section>
    </Container>
  );
}
