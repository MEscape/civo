import { Container, PageHeading, Section } from '@components/layout/layout-primitives';
import { buttonVariants } from '@components/ui/button';

import { Link } from '@i18n';

import { cn } from '@lib/utils';

export interface NotFoundPanelProps {
  readonly title: string;
  readonly description: string;
  readonly returnLabel: string;
}

/**
 * The body of every 404 page. Each route group supplies its own text; the
 * layout and the way home live here once. `Link` is the locale-aware one, so
 * the way home keeps the visitor's language.
 */
export function NotFoundPanel({ title, description, returnLabel }: NotFoundPanelProps) {
  return (
    <Container className="max-w-md">
      <Section className="space-y-8 text-center">
        <PageHeading title={title} description={description} />
        <Link href="/" className={cn(buttonVariants(), 'w-full')}>
          {returnLabel}
        </Link>
      </Section>
    </Container>
  );
}
